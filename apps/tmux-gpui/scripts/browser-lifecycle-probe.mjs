// Opt-in bridge observation, not a GUI or input-authority qualification.
import process from "node:process";
import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { access, stat, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { stopFixtureChild } from "../bridge/fixture-child.mjs";

const LIMIT = 8 * 1024 * 1024;
class ProbeError extends Error {}
const fail = (code) => new ProbeError(code);
export function parseOptions(args) {
  const options = { realHost: false };
  const names = new Map([
    ["--app", "app"],
    ["--cli", "cli"],
    ["--duration-seconds", "duration"],
    ["--machine-id", "machineId"],
    ["--session-id", "sessionId"],
    ["--pane-id", "paneId"],
  ]);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--real-host" && !options.realHost) {
      options.realHost = true;
      continue;
    }
    const key = names.get(args[i]);
    if (!key || options[key] !== undefined || !args[i + 1] || args[i + 1].startsWith("--"))
      throw fail("invalid-options");
    options[key] = args[++i];
  }
  if (!options.app || !isAbsolute(options.app)) throw fail("absolute-app-required");
  if (!/^\d+$/.test(options.duration ?? "")) throw fail("explicit-duration-required");
  options.duration = Number(options.duration);
  if (options.duration < 1 || options.duration > 600) throw fail("duration-out-of-range");
  if (options.realHost) {
    if (options.cli || !options.machineId || !options.sessionId || !options.paneId)
      throw fail("exact-real-target-required");
    for (const id of [options.machineId, options.sessionId, options.paneId])
      if (
        id.length > 512 ||
        Array.from(id).some(
          (c) => c.codePointAt(0) < 32 || (c.codePointAt(0) >= 127 && c.codePointAt(0) <= 159),
        )
      )
        throw fail("invalid-target");
  } else if (
    !options.cli ||
    !isAbsolute(options.cli) ||
    options.machineId ||
    options.sessionId ||
    options.paneId
  ) {
    throw fail("isolated-cli-required");
  }
  return options;
}

export function createOracle(options, now = () => performance.now()) {
  let stage = "catalog",
    session,
    pane,
    readyAt;
  let publications = 0;
  const commands = [{ type: "presence", active: false, revision: 1 }];
  return {
    commands,
    observe(event) {
      if (
        !event ||
        !Number.isSafeInteger(event.request) ||
        !Array.isArray(event.sessions) ||
        !Array.isArray(event.panes)
      )
        throw fail("invalid-publication");
      publications++;
      if (stage === "catalog") {
        if (options.realHost) {
          const groups = event.fleet?.groups?.filter((g) => g.id === options.machineId) ?? [];
          const matches =
            groups.length === 1 ? groups[0].sessions.filter((s) => s.id === options.sessionId) : [];
          if (matches.length > 1) throw fail("ambiguous-target");
          if (matches.length !== 1 || typeof matches[0].selection !== "string") return;
          // Fleet row IDs select routes; selectedSession uses the separate live ID.
          if (typeof matches[0].sessionId !== "string" || !matches[0].sessionId)
            throw fail("live-session-unavailable");
          session = matches[0].sessionId;
          commands.push({ type: "fleet-session", request: 1, selection: matches[0].selection });
        } else {
          if (event.sessions.length !== 1) return;
          session = event.sessions[0].id;
          commands.push({ type: "session", request: 1, id: session });
        }
        stage = "pane";
      } else if (stage === "pane" && event.request === 1 && event.sessionCatalogComplete) {
        if (event.selectedSession !== session) throw fail("session-mismatch");
        const target = options.realHost ? options.paneId : event.panes[0]?.id;
        const matches = event.panes.filter((p) => p.id === target);
        if (matches.length !== 1) throw fail("preferred-pane-unavailable");
        pane = matches[0].id;
        commands.push({ type: "pane", request: 2, id: pane });
        stage = "opening";
      } else if (stage === "opening" || stage === "stable") {
        const ready =
          event.request === 2 &&
          event.surface === "workspace" &&
          event.selectedSession === session &&
          event.selectedPane === pane &&
          event.snapshot != null &&
          event.presenceRevision === 1 &&
          event.inputReady === false;
        if (stage === "stable" && !ready) throw fail("readiness-lost");
        if (ready && readyAt === undefined) {
          readyAt = now();
          stage = "stable";
        }
      }
    },
    summary() {
      return {
        stage,
        publications,
        stableMs: readyAt === undefined ? 0 : Math.max(0, now() - readyAt),
      };
    },
    complete() {
      return readyAt !== undefined && now() - readyAt >= options.duration * 1000;
    },
  };
}

export async function observeChild({
  executable,
  args,
  env,
  cwd,
  options,
  signal,
  startupMs = 60000,
}) {
  const oracle = createOracle(options);
  let child,
    fatal,
    buffer = Buffer.alloc(0),
    stderrBytes = 0,
    result;
  let retiring = false;
  const send = () => {
    for (const command of oracle.commands.splice(0)) {
      if (child.stdin.writableLength > 65536) throw fail("command-backpressure");
      child.stdin.write(JSON.stringify(command) + "\n");
    }
  };
  try {
    child = spawn(executable, args, { env, cwd, stdio: ["pipe", "pipe", "pipe"] });
    child.on("error", () => {
      fatal ??= fail("browser-start-failed");
    });
    child.stdin.on("error", () => {
      if (!retiring) fatal ??= fail("browser-write-failed");
    });
    child.stdout.on("error", () => {
      fatal ??= fail("browser-read-failed");
    });
    child.stdout.on("end", () => {
      if (!retiring) fatal ??= fail("browser-output-ended");
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > LIMIT) fatal ??= fail("diagnostic-limit");
    });
    child.stdout.on("data", (chunk) => {
      if (fatal || retiring) return;
      try {
        buffer = Buffer.concat([buffer, chunk]);
        let end;
        while ((end = buffer.indexOf(10)) >= 0) {
          if (end > LIMIT) throw fail("publication-limit");
          const event = JSON.parse(buffer.subarray(0, end).toString("utf8"));
          buffer = buffer.subarray(end + 1);
          oracle.observe(event);
          send();
        }
        if (buffer.length > LIMIT) throw fail("publication-limit");
      } catch (error) {
        fatal ??= error instanceof ProbeError ? error : fail("publication-rejected");
      }
    });
    send();
    const started = performance.now();
    for (;;) {
      if (signal?.aborted) throw fail("probe-cancelled");
      if (fatal) throw fatal;
      if (child.exitCode !== null || child.signalCode !== null) throw fail("browser-exited");
      if (oracle.complete()) {
        result = { passed: true, ...oracle.summary() };
        break;
      }
      if (oracle.summary().stage !== "stable" && performance.now() - started > startupMs)
        throw fail("startup-deadline");
      await delay(20);
    }
  } finally {
    retiring = true;
    await stopFixtureChild(child);
  }
  return result;
}

function scrubEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      key.startsWith("TMUX_IDE_") ||
      ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(key)
    )
      delete env[key];
  return env;
}
export async function runProbe(options, signal) {
  const resources = join(options.app, "Contents/Resources");
  const node = join(resources, "node"),
    browser = join(resources, "bridge/browser.bundle.mjs");
  for (const [path, mode] of [
    [node, constants.X_OK],
    [browser, constants.R_OK],
    ...(options.cli ? [[options.cli, constants.R_OK]] : []),
  ]) {
    if (!(await stat(path)).isFile()) throw fail("invalid-artifact");
    await access(path, mode);
  }
  const env = scrubEnvironment();
  if (options.realHost) {
    return observeChild({
      executable: node,
      args: [browser, "--local"],
      env: { ...env, PATH: "/usr/bin:/bin" },
      options,
      signal,
    });
  }
  const { createScratchFleet } =
    await import("../../../scripts/lib/product-fixtures/scratch-fleet.ts");
  const { listTmuxServers } =
    await import("../../../packages/daemon-client/src/tmux-server-client.ts");
  // The helper reads process.env; remove selectors before its first allocation.
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  const fleet = await createScratchFleet({
    sessions: 1,
    windowsPerSession: 2,
    slug: "gpui-lifecycle",
  });
  let daemon, result;
  const failures = [];
  try {
    daemon = spawn(process.execPath, [options.cli, "--headless"], {
      env: { ...env, ...fleet.environment },
      stdio: "ignore",
    });
    let spawnFailed = false;
    daemon.on("error", () => {
      spawnFailed = true;
    });
    const deadline = performance.now() + 30000;
    let record;
    while (!record) {
      if (signal?.aborted) throw fail("probe-cancelled");
      if (spawnFailed || daemon.exitCode !== null || daemon.signalCode !== null)
        throw fail("daemon-exited");
      if (performance.now() > deadline) throw fail("daemon-deadline");
      try {
        const value = JSON.parse(await readFile(join(fleet.daemonInfoDir, "daemon.json"), "utf8"));
        if (value.pid === daemon.pid) record = value;
      } catch {
        /* Await only the owned atomic discovery record. */
      }
      if (!record) await delay(20);
    }
    const client = {
      baseUrl: `http://127.0.0.1:${record.port}/`,
      ownerToken: record.authToken,
      hostClientId: "gpui-lifecycle-probe",
      origin: "tmux-ide://app",
    };
    const servers = (await listTmuxServers(client)).servers.filter((s) => s.state === "online");
    if (servers.length !== 1) throw fail("isolated-server-ambiguous");
    const config = join(fleet.root, "host.json");
    await writeFile(
      config,
      JSON.stringify({
        baseUrl: client.baseUrl,
        ownerToken: client.ownerToken,
        scope: { serverId: servers[0].serverId, generation: servers[0].generation },
      }),
      { mode: 0o600 },
    );
    result = await observeChild({
      executable: node,
      args: [browser, config],
      env: { ...env, ...fleet.environment, PATH: "/usr/bin:/bin" },
      cwd: fleet.root,
      options,
      signal,
    });
  } catch (error) {
    failures.push(error);
  } finally {
    for (const cleanup of [() => stopFixtureChild(daemon), () => fleet.dispose()]) {
      try {
        await cleanup();
      } catch {
        failures.push(fail("cleanup-failed"));
      }
    }
  }
  if (failures.length) throw failures[0];
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const options = parseOptions(process.argv.slice(2));
    const result = await runProbe(options, controller.signal);
    process.stdout.write(
      JSON.stringify({
        ...result,
        mode: options.realHost ? "real-host-observation" : "isolated-fixture",
        cleanup: true,
      }) + "\n",
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
