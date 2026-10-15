// Isolated switching and explicit discovery recovery; never a real-host entry.
import process from "node:process";
import { Buffer } from "node:buffer";
import { spawn, execFileSync } from "node:child_process";
import { access, stat, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { diagnosticStatus, parseDiagnosticLine } from "../bridge/live-diagnostics.ts";
import { stopFixtureChild } from "../bridge/fixture-child.mjs";

class ProbeError extends Error {}
const fail = (code) => new ProbeError(code);
const LIMIT = 8 * 1024 * 1024;
export function parseOptions(args) {
  const options = {};
  const keys = new Map([
    ["--app", "app"],
    ["--cli", "cli"],
    ["--cycles", "cycles"],
    ["--hold-seconds", "hold"],
  ]);
  for (let i = 0; i < args.length; i++) {
    const key = keys.get(args[i]);
    if (!key || options[key] !== undefined || !args[i + 1] || args[i + 1].startsWith("--"))
      throw fail("invalid-options");
    options[key] = args[++i];
  }
  if (!options.app || !options.cli || !isAbsolute(options.app) || !isAbsolute(options.cli))
    throw fail("absolute-artifacts-required");
  for (const [key, max] of [
    ["cycles", 10],
    ["hold", 30],
  ]) {
    if (!/^\d+$/.test(options[key] ?? "") || +options[key] < 1 || +options[key] > max)
      throw fail("explicit-bounded-interval-required");
    options[key] = +options[key];
  }
  return options;
}

export function createPhaseOracle() {
  let connection, latest, expectation;
  let publications = 0,
    disconnectObserved = false;
  return {
    get latest() {
      return latest;
    },
    get publications() {
      return publications;
    },
    transition() {
      expectation = undefined;
      disconnectObserved = false;
    },
    pane(request, session, id) {
      expectation = { kind: "pane", request, session, id, ready: false };
    },
    disconnected() {
      if (!latest) throw fail("missing-disconnect-baseline");
      expectation = { kind: "disconnect", sequence: latest.sequence };
      disconnectObserved = false;
    },
    diagnostic(line) {
      const value = parseDiagnosticLine(line);
      if (
        expectation?.kind !== "disconnect" ||
        value?.code !== "transport-closed" ||
        value.closeCode !== 1001
      )
        throw fail("unexpected-diagnostic");
    },
    ready() {
      return expectation?.kind === "pane" && expectation.ready;
    },
    isDisconnected() {
      return disconnectObserved;
    },
    observe(event) {
      if (
        !event ||
        typeof event.connection !== "string" ||
        !Number.isSafeInteger(event.sequence) ||
        !Number.isSafeInteger(event.request)
      )
        throw fail("invalid-publication");
      connection ??= event.connection;
      if (event.connection !== connection) throw fail("browser-connection-replaced");
      if (latest && event.sequence <= latest.sequence) throw fail("publication-sequence-regressed");
      latest = event;
      publications++;
      if (expectation?.kind === "pane") {
        const ready =
          event.request === expectation.request &&
          event.selectedSession === expectation.session &&
          event.selectedPane === expectation.id &&
          event.surface === "workspace" &&
          event.snapshot != null &&
          event.inputReady === true &&
          event.presenceRevision === 1;
        if (expectation.ready && !ready) throw fail("steady-readiness-lost");
        if (ready) expectation.ready = true;
      } else if (expectation?.kind === "disconnect" && event.sequence > expectation.sequence) {
        const unavailable = event.snapshot === null && event.inputReady === false;
        if (disconnectObserved && !unavailable) throw fail("disconnected-authority-returned");
        if (
          unavailable &&
          event.status === diagnosticStatus({ code: "transport-closed", closeCode: 1001 })
        )
          disconnectObserved = true;
      }
    },
  };
}

export async function runProbe(options, signal) {
  const resources = join(options.app, "Contents/Resources");
  const node = join(resources, "node"),
    browserPath = join(resources, "bridge/browser.bundle.mjs");
  for (const [path, mode] of [
    [node, constants.X_OK],
    [browserPath, constants.R_OK],
    [options.cli, constants.R_OK],
  ]) {
    if (!(await stat(path)).isFile()) throw fail("invalid-artifact");
    await access(path, mode);
  }
  for (const key of Object.keys(process.env))
    if (
      key.startsWith("TMUX_IDE_") ||
      ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(key)
    )
      delete process.env[key];
  const { createScratchFleet } =
    await import("../../../scripts/lib/product-fixtures/scratch-fleet.ts");
  const fleet = await createScratchFleet({
    sessions: 1,
    windowsPerSession: 2,
    slug: "gpui-switch-recovery",
  });
  const env = { ...process.env, ...fleet.environment };
  let daemon,
    browser,
    fatal,
    retiring = false,
    result;
  const failures = [],
    oracle = createPhaseOracle(),
    stages = [];
  let buffer = Buffer.alloc(0),
    stderrBytes = 0,
    stderrBuffer = "",
    request = 0;
  const check = () => {
    if (signal?.aborted) throw fail("probe-cancelled");
    if (fatal) throw fatal;
    if (browser && (browser.exitCode !== null || browser.signalCode !== null))
      throw fail("browser-exited");
  };
  const until = async (predicate, timeout = 45000) => {
    const end = performance.now() + timeout;
    for (;;) {
      check();
      if (predicate()) {
        check();
        return;
      }
      if (performance.now() >= end) throw fail("phase-deadline");
      await delay(20);
    }
  };
  const hold = async () => {
    const end = performance.now() + options.hold * 1000;
    await until(() => performance.now() >= end, options.hold * 1000 + 1000);
  };
  const send = (command) => {
    check();
    if (!browser.stdin.writable || browser.stdin.writableLength > 65536)
      throw fail("command-backpressure");
    browser.stdin.write(JSON.stringify(command) + "\n");
  };
  const identities = () =>
    execFileSync(
      fleet.environment.TMUX_IDE_TMUX_BIN,
      [
        "-S",
        fleet.socketPath,
        "list-panes",
        "-a",
        "-F",
        "#{session_id}|#{window_id}|#{pane_id}|#{pane_pid}|#{pane_birth_id}|#{pane_left}|#{pane_top}|#{pane_width}|#{pane_height}",
      ],
      { env, encoding: "utf8", timeout: 5000, maxBuffer: 65536 },
    )
      .trim()
      .split("\n")
      .sort()
      .join("\n");
  const startDaemon = async () => {
    daemon = spawn(process.execPath, [options.cli, "--headless"], { env, stdio: "ignore" });
    let failed = false,
      record;
    daemon.on("error", () => {
      failed = true;
    });
    const deadline = performance.now() + 45000;
    while (!record) {
      check();
      if (failed || daemon.exitCode !== null || daemon.signalCode !== null)
        throw fail("daemon-exited");
      if (performance.now() > deadline) throw fail("daemon-start-deadline");
      try {
        const value = JSON.parse(await readFile(join(fleet.daemonInfoDir, "daemon.json"), "utf8"));
        if (value.pid === daemon.pid && typeof value.instanceId === "string") record = value;
      } catch {
        /* Await the owned atomic discovery record. */
      }
      if (!record) await delay(20);
    }
    return record;
  };
  const selectSession = async (sessionId) => {
    oracle.transition();
    send({ type: "session", request: ++request, id: sessionId });
    await until(
      () =>
        oracle.latest?.request === request &&
        oracle.latest.selectedSession === sessionId &&
        oracle.latest.sessionCatalogComplete === true,
    );
    return oracle.latest.panes;
  };
  const selectPane = async (sessionId, pane) => {
    oracle.pane(++request, sessionId, pane.id);
    send({ type: "pane", request, id: pane.id });
    await until(() => oracle.ready());
    const selected = oracle.latest.panes.filter((p) => p.id === pane.id);
    if (selected.length !== 1 || selected[0].windowId !== pane.windowId)
      throw fail("window-target-mismatch");
    await hold();
  };
  try {
    const before = identities();
    const originalDaemon = await startDaemon();
    browser = spawn(node, [browserPath, "--local"], {
      env: { ...env, PATH: "/usr/bin:/bin" },
      cwd: fleet.root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const browserPid = browser.pid;
    browser.on("error", () => {
      fatal ??= fail("browser-start-failed");
    });
    browser.stdin.on("error", () => {
      if (!retiring) fatal ??= fail("browser-write-failed");
    });
    browser.stdout.on("error", () => {
      fatal ??= fail("browser-read-failed");
    });
    browser.stdout.on("end", () => {
      if (!retiring) fatal ??= fail("browser-output-ended");
    });
    browser.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > LIMIT) fatal ??= fail("diagnostic-limit");
      if (fatal) return;
      stderrBuffer += chunk.toString("utf8");
      try {
        let end;
        while ((end = stderrBuffer.indexOf("\n")) >= 0) {
          oracle.diagnostic(stderrBuffer.slice(0, end));
          stderrBuffer = stderrBuffer.slice(end + 1);
        }
        if (Buffer.byteLength(stderrBuffer) > 256) throw fail("unexpected-diagnostic");
      } catch (error) {
        fatal ??= error;
      }
    });
    browser.stdout.on("data", (chunk) => {
      if (fatal || retiring) return;
      try {
        buffer = Buffer.concat([buffer, chunk]);
        let end;
        while ((end = buffer.indexOf(10)) >= 0) {
          if (end > LIMIT) throw fail("publication-limit");
          const event = JSON.parse(buffer.subarray(0, end).toString("utf8"));
          buffer = buffer.subarray(end + 1);
          oracle.observe(event);
        }
        if (buffer.length > LIMIT) throw fail("publication-limit");
      } catch (error) {
        fatal ??= error instanceof ProbeError ? error : fail("publication-rejected");
      }
    });
    send({ type: "presence", active: true, revision: 1 });
    await until(
      () => oracle.latest?.home?.phase === "live" && oracle.latest.sessions?.length === 1,
    );
    const session = oracle.latest.sessions[0].id;
    const panes = await selectSession(session);
    // Initial ordinary-session adoption enables top pane borders. Preserve native
    // identity from creation, but measure geometry after that documented admission.
    const admitted = identities();
    if (
      panes.length !== 2 ||
      !panes.every((p) => typeof p.id === "string" && typeof p.windowId === "string") ||
      panes[0].id === panes[1].id ||
      panes[0].windowId === panes[1].windowId
    )
      throw fail("fixture-window-topology-mismatch");
    for (let cycle = 0; cycle < options.cycles; cycle++) {
      for (const pane of panes) await selectPane(session, pane);
      stages.push({ stage: "switch-cycle", cycle: cycle + 1, windows: 2 });
    }
    oracle.disconnected();
    await stopFixtureChild(daemon);
    daemon = undefined;
    await until(() => oracle.isDisconnected());
    await hold();
    stages.push({ stage: "disconnected", snapshot: false, inputReady: false });
    const replacement = await startDaemon();
    if (replacement.instanceId === originalDaemon.instanceId) throw fail("daemon-not-replaced");
    oracle.transition();
    send({ type: "refresh", request: ++request });
    await until(() => oracle.latest?.request === request && oracle.latest.home?.phase === "live");
    if (oracle.latest.sessions.filter((s) => s.id === session).length !== 1)
      throw fail("original-session-unavailable");
    const fresh = await selectSession(session);
    for (const target of panes) {
      const exact = fresh.filter((p) => p.id === target.id && p.windowId === target.windowId);
      if (exact.length !== 1) throw fail("original-pane-unavailable");
      await selectPane(session, exact[0]);
    }
    if (browser.pid !== browserPid) throw fail("browser-process-changed");
    const after = identities();
    const identity = (text) =>
      text
        .split("\n")
        .map((line) => line.split("|").slice(0, 5).join("|"))
        .join("\n");
    if (identity(before) !== identity(after)) throw fail("owned-native-identity-changed");
    if (admitted !== after) {
      const fields = [
        "session",
        "window",
        "pane",
        "pid",
        "birth",
        "left",
        "top",
        "width",
        "height",
      ];
      const a = admitted.split("\n"),
        b = after.split("\n");
      const changed = fields.filter((_, i) =>
        a.some((line, n) => line.split("|")[i] !== b[n]?.split("|")[i]),
      );
      throw fail("owned-source-changed-" + changed.join("-"));
    }
    check();
    stages.push({ stage: "recovered", sameBrowser: true, exactOriginalTargets: true });
    result = {
      passed: true,
      stages,
      publications: oracle.publications,
      sourceIdentityPreserved: true,
      admittedGeometryPreserved: true,
    };
  } catch (error) {
    failures.push(error);
  } finally {
    retiring = true;
    for (const cleanup of [
      () => stopFixtureChild(browser),
      () => stopFixtureChild(daemon),
      () => fleet.dispose(),
    ]) {
      try {
        await cleanup();
      } catch {
        failures.push(fail("cleanup-failed"));
      }
    }
  }
  if (signal?.aborted) failures.push(fail("probe-cancelled"));
  if (fatal) failures.push(fatal);
  if (stderrBuffer.length) failures.push(fail("incomplete-diagnostic"));
  if (failures.length) throw failures[0];
  return { ...result, cleanup: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const controller = new AbortController(),
    cancel = () => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    process.stdout.write(
      JSON.stringify(await runProbe(parseOptions(process.argv.slice(2)), controller.signal)) + "\n",
    );
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        passed: false,
        reason: error instanceof ProbeError ? error.message : "probe-failed",
      }) + "\n",
    );
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}
