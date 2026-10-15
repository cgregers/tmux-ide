// Isolated canonical daemon + source or explicitly selected packaged browser. No GUI, input, resize or personal discovery.
import assert from "node:assert/strict";
import process from "node:process";
import console from "node:console";
import { Buffer } from "node:buffer";
import { spawn, execFileSync } from "node:child_process";
import { access, stat, readFile, rm, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createScratchFleet } from "../../scripts/lib/product-fixtures/scratch-fleet.ts";
import { stopFixtureChild } from "../../apps/tmux-gpui/bridge/fixture-child.mjs";
// Validate an explicit package before CLI checks or any scratch allocation. Never fall back.
const app = process.env.TMUX_GPUI_TEST_APP;
if (app !== undefined) {
  assert.ok(isAbsolute(app), "TMUX_GPUI_TEST_APP must be a nonempty absolute path");
  assert.ok((await stat(app)).isDirectory(), "TMUX_GPUI_TEST_APP must be a directory");
  for (const file of ["node", "bridge/browser.bundle.mjs", "bridge/live.bundle.mjs"]) {
    const path = join(app, "Contents/Resources", file);
    assert.ok((await stat(path)).isFile(), "Packaged helper must be a regular file");
    await access(path, file === "node" ? constants.X_OK : constants.R_OK);
  }
}
const browserNode = app === undefined ? process.execPath : join(app, "Contents/Resources/node");
const browserEntry =
  app === undefined
    ? fileURLToPath(new URL("../../apps/tmux-gpui/bridge/browser.ts", import.meta.url))
    : join(app, "Contents/Resources/bridge/browser.bundle.mjs");
const cli = process.env.TMUX_GPUI_TEST_CLI;
assert.ok(cli && isAbsolute(cli), "Explicit absolute private CLI required");
assert.ok((await stat(cli)).isFile());
await access(cli, constants.R_OK);
for (const key of Object.keys(process.env))
  if (
    key.startsWith("TMUX_IDE_") ||
    ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(key)
  )
    delete process.env[key];
const fleet = await createScratchFleet({
  sessions: 2,
  windowsPerSession: 1,
  slug: "workspace-agents",
});
const canonical = join(fleet.root, "canonical"),
  temporary = join(fleet.root, "tmp");
const env = {
  ...process.env,
  ...fleet.environment,
  TMUX: "",
  TMPDIR: temporary,
  TMUX_IDE_DAEMON_INFO_DIR: canonical,
  TMUX_IDE_REGISTRY_DIR: canonical,
  TMUX_IDE_TMUX_SOCKET_PATH: fleet.socketPath,
};
delete env.TMUX_IDE_TMUX_SOCKET_NAME;
const tmux = (...args) =>
  execFileSync(env.TMUX_IDE_TMUX_BIN, ["-S", fleet.socketPath, ...args], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });
const source = () =>
  tmux("list-panes", "-a", "-F", "#{pane_id}|#{pane_pid}|#{pane_birth_id}")
    .trim()
    .split("\n")
    .sort();
let before;
let daemon,
  browser,
  latest,
  record,
  fatal,
  closing = false,
  buffer = "",
  stderrBytes = 0,
  request = 0,
  publications = 0;
const failures = [];
// Bounded metadata only: no frame contents, canonical keys, capability UUIDs or credentials.
const trace = [];
let phase = "startup",
  lastTrace = "";
const traceState = (event) => {
  const value = {
    phase,
    event,
    request: latest?.request,
    sequence: latest?.sequence,
    catalog: latest?.sessionCatalogComplete,
    frame: !!latest?.snapshot,
    input: latest?.inputReady === true,
    history: latest?.sessionHistory
      ? {
          revision: latest.sessionHistory.revision,
          back: !!latest.sessionHistory.back,
          forward: !!latest.sessionHistory.forward,
        }
      : null,
    workspaceAgents: latest?.workspaceFleetAgents
      ? {
          request: latest.workspaceFleetAgents.request,
          scope: latest.workspaceFleetAgents.scope,
          revision: latest.workspaceFleetAgents.revision,
          phase: latest.workspaceFleetAgents.phase,
          rows: latest.workspaceFleetAgents.rows.length,
          selected: !!latest.workspaceFleetAgents.selectedKey,
        }
      : null,
    preferences: latest?.fleet?.preferences?.phase,
    status: latest?.status,
  };
  const signature = JSON.stringify({ ...value, sequence: undefined });
  if (signature !== lastTrace) {
    lastTrace = signature;
    if (trace.length === 256) trace.shift();
    trace.push(value);
  }
};
const deadline = Date.now() + 180000;
const cancel = () => {
  fatal ??= new Error("History fixture cancelled");
};
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
const own = (child) => {
  child.on("error", () => {
    fatal ??= new Error("Owned child spawn failed");
  });
  child.on("exit", () => {
    if (!closing) fatal ??= new Error("Owned child exited early");
  });
  return child;
};
async function until(predicate) {
  const phase = Date.now() + 45000;
  for (;;) {
    if (fatal) throw fatal;
    if (await predicate()) return;
    assert.ok(
      Date.now() < Math.min(deadline, phase),
      `History phase deadline (${latest?.request}/${latest?.status})`,
    );
    await delay(20);
  }
}
async function recent() {
  const response = await globalThis.fetch(
    `http://127.0.0.1:${record.port}/api/resources/fleet-client-state`,
    {
      headers: { Authorization: `Bearer ${record.authToken}` },
      signal: globalThis.AbortSignal.timeout(5000),
      redirect: "error",
    },
  );
  assert.equal(response.status, 200);
  const reader = response.body.getReader(),
    chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      assert.ok(bytes <= 256 * 1024, "Preference response overflow");
      chunks.push(item.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  assert.equal(value.daemon.instanceId, record.instanceId);
  return value.state.recent;
}
const send = (value) => {
  traceState(`send:${value.type}:${value.request ?? "presence"}`);
  browser.stdin.write(JSON.stringify(value) + "\n");
};
async function completeCatalog(expected, prior) {
  traceState("await-catalog");
  await until(
    () =>
      latest?.request === request &&
      latest.sessionCatalogComplete === true &&
      latest.preferredPane &&
      latest.selectedSession === expected.sessionId,
  );
  traceState("catalog-ready");
  assert.equal(latest.snapshot, null);
  assert.equal(latest.inputReady, false);
  assert.deepEqual(await recent(), prior, "Catalog-only must not record a visit");
  const pane = latest.preferredPane;
  assert.ok(latest.panes.some((p) => p.id === pane));
  send({ type: "pane", request: ++request, id: pane });
  await until(
    () =>
      latest?.request === request &&
      latest.selectedSession === expected.sessionId &&
      latest.selectedPane === pane &&
      latest.snapshot &&
      latest.inputReady === true,
  );
  traceState("live-ready");
  await until(async () => (await recent())[0] === expected.id);
  traceState("storage-acknowledged");
  return pane;
}
try {
  await mkdir(canonical, { mode: 0o700 });
  await mkdir(temporary, { mode: 0o700 });
  before = source();
  for (const [index, pane] of fleet.initialPanes.entries()) {
    tmux("set-option", "-p", "-t", pane.paneId, "@agent_display_name", "Duplicate agent");
    tmux(
      "set-option",
      "-p",
      "-t",
      pane.paneId,
      "@agent_state",
      `${index ? "blocked" : "working"}:${Math.floor(Date.now() / 1000)}`,
    );
  }
  daemon = own(
    spawn(process.execPath, [cli, "--headless"], {
      env,
      cwd: fleet.projectDir,
      stdio: ["ignore", "ignore", "pipe"],
    }),
  );
  daemon.stderr.on("data", (data) => {
    stderrBytes += data.length;
    if (stderrBytes > 65536) fatal ??= new Error("Diagnostic bound exceeded");
  });
  daemon.stderr.on("error", cancel);
  await until(async () => {
    try {
      record = JSON.parse(await readFile(canonical + "/daemon.json", "utf8"));
      return record.pid === daemon.pid;
    } catch {
      return false;
    }
  });
  browser = own(
    spawn(
      browserNode,
      [
        ...(app === undefined ? ["--import", import.meta.resolve("tsx")] : []),
        browserEntry,
        "--local",
      ],
      { env, stdio: ["pipe", "pipe", "pipe"], ...(app === undefined ? {} : { cwd: fleet.root }) },
    ),
  );
  for (const stream of [browser.stdin, browser.stdout, browser.stderr]) stream.on("error", cancel);
  browser.stderr.on("data", (data) => {
    stderrBytes += data.length;
    if (stderrBytes > 65536) fatal ??= new Error("Diagnostic bound exceeded");
  });
  browser.stdout.setEncoding("utf8");
  browser.stdout.on("data", (data) => {
    try {
      buffer += data;
      assert.ok(Buffer.byteLength(buffer) <= 8 * 1024 * 1024);
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        assert.ok(++publications <= 20000, "Publication count overflow");
        latest = JSON.parse(buffer.slice(0, end));
        traceState("publication");
        if (latest.sessionHistoryRejected)
          assert.equal(latest.sessionHistoryRejected.fromRequest, latest.request);
        buffer = buffer.slice(end + 1);
      }
    } catch {
      fatal ??= new Error("Invalid publication");
    }
  });
  browser.stdout.on("end", () => {
    if (!closing || buffer.length)
      fatal ??= new Error("Browser publication stream ended unexpectedly");
  });
  send({ type: "presence", active: true, revision: 1 });
  await until(
    () =>
      latest?.presenceRevision === 1 &&
      latest.home?.phase === "live" &&
      latest.fleet?.preferences?.phase === "ready" &&
      latest.fleet.groups.find((g) => g.id === "local")?.sessions.length === 2 &&
      latest.sessions.length === 2,
  );
  const group = latest.fleet.groups.find((g) => g.id === "local");
  const a = group.sessions.find((s) => s.name === fleet.sessionNames[0]);
  const b = group.sessions.find((s) => s.name === fleet.sessionNames[1]);
  assert.ok(a && b && a.selection && b.selection);
  assert.deepEqual(await recent(), []);
  phase = "initial-workspace";
  send({ type: "session", request: ++request, id: a.sessionId });
  await completeCatalog(a, []);
  await until(
    () =>
      latest.workspaceFleetAgents?.request === request &&
      latest.workspaceFleetAgents.rows.some((r) => r.sessionId === b.sessionId && r.available),
  );
  const roster = latest.workspaceFleetAgents;
  const target = roster.rows.find((r) => r.sessionId === b.sessionId && r.available);
  assert.equal(target.name, "Duplicate agent");
  assert.equal(target.status, "BLOCKED");
  assert.ok(roster.rows.some((r) => r.sessionId === a.sessionId));
  const selectedPane = latest.selectedPane;
  phase = "palette-overlap";
  send({ type: "palette-observe", request, scope: 1, active: true, query: "fixture-no-match-731" });
  await until(() => latest.paletteAgents?.scope === 1 && latest.paletteAgents.rows.length === 0);
  assert.ok(latest.workspaceFleetAgents.rows.some((r) => r.key === target.key && r.available));
  send({ type: "palette-observe", request, scope: 1, active: false });
  await until(() => latest.paletteAgents === null);
  assert.ok(latest.workspaceFleetAgents.rows.some((r) => r.key === target.key && r.available));
  phase = "stale-scope";
  const current = latest.request;
  const stale = {
    type: "open-workspace-fleet-agent",
    request: ++request,
    fromRequest: current,
    scope: latest.workspaceFleetAgents.scope + 1,
    rosterRevision: latest.workspaceFleetAgents.revision,
    key: target.key,
  };
  send(stale);
  await until(() => latest.workspaceFleetAgentRejected?.request === stale.request);
  assert.equal(latest.request, current);
  assert.equal(latest.selectedPane, selectedPane);
  assert.ok(latest.snapshot && latest.inputReady);
  phase = "cross-session-admission";
  send({
    type: "open-workspace-fleet-agent",
    request: ++request,
    fromRequest: current,
    scope: latest.workspaceFleetAgents.scope,
    rosterRevision: latest.workspaceFleetAgents.revision,
    key: target.key,
  });
  await until(
    () =>
      latest.request === request &&
      latest.selectedSession === b.sessionId &&
      latest.snapshot &&
      latest.inputReady,
  );
  const expected = tmux(
    "display-message",
    "-p",
    "-t",
    fleet.initialPanes[1].paneId,
    "#{@tmux_ide_pane_id}",
  ).trim();
  assert.ok(expected);
  assert.equal(latest.selectedPane, expected);
  await until(
    () =>
      latest.workspaceFleetAgents?.request === request && latest.workspaceFleetAgents.selectedKey,
  );
  assert.equal(
    latest.workspaceFleetAgents.rows.find((r) => r.key === latest.workspaceFleetAgents.selectedKey)
      ?.sessionId,
    b.sessionId,
  );
  assert.deepEqual(source(), before, "Native pane births and processes survive history navigation");
} catch (error) {
  failures.push(error);
} finally {
  closing = true;
  let childCleanupFailed = false;
  for (const cleanup of [
    () => browser && stopFixtureChild(browser),
    () => daemon && stopFixtureChild(daemon),
  ])
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
      childCleanupFailed = true;
    }
  // Bounded cleanup addresses only the server created by this fixture. Retain its root on failure.
  try {
    tmux("kill-server");
    if (!childCleanupFailed) await rm(fleet.root, { recursive: true, force: true });
  } catch (error) {
    failures.push(error);
  }
}
if (fatal && !failures.includes(fatal)) failures.push(fatal);
process.off("SIGINT", cancel);
process.off("SIGTERM", cancel);
if (failures.length) {
  console.error(JSON.stringify({ historyPhaseTrace: trace }));
  throw new AggregateError(failures, "Session history fixture failed");
}
console.log(
  JSON.stringify({
    passed: true,
    sourceBrowser: app === undefined,
    packagedBrowser: app !== undefined,
    canonicalDaemon: true,
    crossSessionAgents: true,
    paletteIndependent: true,
    staleScopePreservedTerminal: true,
    exactSecondSessionPane: true,
    selectedKeyVerified: true,
    sourceBirthsPreserved: true,
    inputSent: false,
    nativeUi: false,
    ownedCleanup: true,
  }),
);
