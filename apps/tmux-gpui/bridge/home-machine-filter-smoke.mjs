// Private real-daemon Home machine-filter qualification; no GUI or generated CLI build.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import process from "node:process";
import { spawn, execFileSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { join, isAbsolute } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createScratchFleet } from "../../../scripts/lib/product-fixtures/scratch-fleet.ts";
import { stopFixtureChild } from "./fixture-child.mjs";

// An explicit package is mandatory when supplied: validate before creating scratch resources.
const app = process.env.TMUX_GPUI_TEST_APP;
if (app !== undefined) {
  assert.ok(isAbsolute(app), "TMUX_GPUI_TEST_APP must be a nonempty absolute path");
  assert.ok((await stat(app)).isDirectory(), "TMUX_GPUI_TEST_APP must be a directory");
  for (const file of ["node", "bridge/browser.bundle.mjs"]) {
    const path = join(app, "Contents/Resources", file);
    assert.ok((await stat(path)).isFile(), "Packaged helper must be a regular file");
    await access(path, file === "node" ? constants.X_OK : constants.R_OK);
  }
}
const browserNode = app === undefined ? process.execPath : join(app, "Contents/Resources/node");
const browserEntry =
  app === undefined
    ? fileURLToPath(new URL("./browser.ts", import.meta.url))
    : join(app, "Contents/Resources/bridge/browser.bundle.mjs");
const cli = process.env.TMUX_GPUI_TEST_CLI;
assert.ok(cli && isAbsolute(cli), "Provide absolute TMUX_GPUI_TEST_CLI");
for (const key of Object.keys(process.env))
  if (
    key.startsWith("TMUX_IDE_") ||
    ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(key)
  )
    delete process.env[key];
const fleet = await createScratchFleet({
  sessions: 2,
  windowsPerSession: 1,
  slug: "home-machine-filter",
});
const env = { ...process.env, ...fleet.environment };
const tmux = (...args) =>
  execFileSync(env.TMUX_IDE_TMUX_BIN, ["-S", fleet.socketPath, ...args], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });
let daemon,
  browser,
  latest,
  fatal,
  closing = false;
let buffer = "",
  stderrBytes = 0,
  publications = 0;
const failures = [];
const until = async (predicate) => {
  const deadline = Date.now() + 60000;
  for (;;) {
    if (fatal) throw fatal;
    if (await predicate()) {
      if (fatal) throw fatal;
      return;
    }
    assert.ok(
      Date.now() < deadline,
      "Home machine-filter fixture deadline: " +
        JSON.stringify({
          request: latest?.request,
          status: latest?.status,
          connection: latest?.connection,
          fleet: latest?.fleet?.groups?.map((g) => ({
            state: g.state,
            sessions: g.sessions.length,
            conflict: g.conflict,
          })),
          surface: latest?.surface,
          phase: latest?.homeAgents?.phase,
          observed: latest?.homeAgents?.observedSessions,
          total: latest?.homeAgents?.totalSessions,
          truncated: latest?.homeAgents?.truncatedSessions,
          rows: latest?.homeAgents?.rows?.length,
          recovery: latest?.homeAgentRecovery,
          publications,
        }),
    );
    await delay(20);
  }
};
const ownChild = (child) => {
  child.on("error", (error) => {
    fatal ??= error;
  });
  child.on("exit", () => {
    if (!closing) fatal ??= new Error("Fixture child exited unexpectedly");
  });
  return child;
};
try {
  assert.equal(fleet.initialPanes.length, 2);
  for (const { paneId } of fleet.initialPanes) {
    tmux("set-option", "-p", "-t", paneId, "@agent_display_name", "Filter agent");
    tmux(
      "set-option",
      "-p",
      "-t",
      paneId,
      "@agent_state",
      `blocked:${Math.floor(Date.now() / 1000)}`,
    );
    assert.equal(tmux("display-message", "-p", "-t", paneId, "#{@tmux_ide_pane_id}").trim(), "");
  }
  const source = () =>
    tmux(
      "list-panes",
      "-a",
      "-F",
      "#{session_id}|#{session_name}|#{window_id}|#{pane_id}|#{pane_birth_id}|#{pane_pid}|#{pane_width}|#{pane_height}|#{@tmux_ide_pane_id}",
    )
      .split("\n")
      .filter(Boolean)
      .sort();
  const before = source();
  daemon = ownChild(spawn(process.execPath, [cli, "--headless"], { env, stdio: "ignore" }));
  await until(async () => {
    try {
      return (
        JSON.parse(await readFile(fleet.daemonInfoDir + "/daemon.json", "utf8")).pid === daemon.pid
      );
    } catch {
      return false;
    }
  });
  browser = ownChild(
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
  for (const stream of [browser.stdin, browser.stdout, browser.stderr])
    stream.on("error", (error) => {
      fatal ??= error;
    });
  browser.stderr.on("data", (data) => {
    stderrBytes += data.length;
    if (stderrBytes > 65536) fatal ??= new Error("Diagnostics overflow");
  });
  browser.stdout.setEncoding("utf8");
  browser.stdout.on("data", (data) => {
    try {
      buffer += data;
      assert.ok(Buffer.byteLength(buffer) <= 8 * 1024 * 1024, "Publication buffer overflow");
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        latest = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        assert.ok(++publications <= 10000, "Publication count overflow");
      }
    } catch (error) {
      fatal ??= error;
    }
  });
  const send = (value) => browser.stdin.write(JSON.stringify(value) + "\n");
  // Establish foreground intent before awaiting the resident Home observation.
  send({ type: "presence", active: true, revision: 1 });
  await until(
    () =>
      latest?.presenceRevision === 1 &&
      latest.homeAgents?.observedSessions === 2 &&
      latest.homeAgentFilter &&
      latest.fleet?.groups?.some((group) => group.id === "local" && group.state === "ready"),
  );
  const connection = latest.connection;
  const request = latest.request;
  send({ type: "attention-observe", request, scope: 1, active: true });
  await until(
    () => latest?.attentionAgents?.scope === 1 && latest.attentionAgents.rows.length === 2,
  );
  const assertContext = () => {
    const local = latest.fleet.groups.find((group) => group.id === "local");
    for (const roster of [latest.homeAgents, latest.attentionAgents]) {
      assert.deepEqual(
        roster.rows.map((row) => row.sessionLabel).sort(),
        [...fleet.sessionNames].sort(),
        "Session labels must retain exact fixture names without a machine prefix",
      );
      for (const row of roster.rows) {
        assert.equal(row.machineLabel, local.label);
        // The canonical configless shell project is the explicitly created session.
        assert.equal(row.projectName, row.sessionLabel);
      }
    }
  };
  assertContext();
  const initialRevision = latest.homeAgents.revision;
  const machineId = latest.fleet.groups.find((group) => group.id === "local").id;
  send({ type: "home-agent-filter", request, rosterRevision: initialRevision, machineId });
  await until(
    () =>
      latest?.homeAgentFilter?.machineId === machineId &&
      latest.homeAgentFilter.revision === latest.homeAgents.revision &&
      latest.homeAgents.revision > initialRevision,
  );
  assert.equal(latest.homeAgents.observedSessions, 2);
  assert.equal(latest.homeAgents.totalSessions, 2);
  assert.equal(latest.attentionAgents.scope, 1);
  assert.equal(latest.attentionAgents.rows.length, 2);
  const selectedRevision = latest.homeAgents.revision;
  // Ordered same-pipe barrier: stale clear must not change the selection before presence ACK.
  send({ type: "home-agent-filter", request, rosterRevision: initialRevision, machineId: null });
  send({ type: "presence", active: true, revision: 2 });
  await until(() => latest?.presenceRevision === 2);
  assert.equal(latest.homeAgentFilter.machineId, machineId);
  assert.ok(latest.homeAgentFilter.revision >= selectedRevision);
  const clearRevision = latest.homeAgents.revision;
  send({ type: "home-agent-filter", request, rosterRevision: clearRevision, machineId: null });
  await until(
    () =>
      latest?.homeAgentFilter?.machineId === null &&
      latest.homeAgentFilter.revision === latest.homeAgents.revision &&
      latest.homeAgents.revision > clearRevision,
  );
  assert.equal(latest.homeAgents.observedSessions, 2);
  assert.equal(latest.homeAgents.totalSessions, 2);
  assert.equal(latest.attentionAgents.scope, 1);
  assert.equal(latest.attentionAgents.rows.length, 2);
  assertContext();
  assert.equal(latest.connection, connection);
  assert.equal(latest.request, request);
  assert.equal(latest.surface, "home");
  assert.equal(latest.selectedSession, null);
  assert.equal(latest.selectedPane, null);
  assert.equal(latest.inputReady, false);
  assert.equal(latest.snapshot, null);
  assert.deepEqual(
    source(),
    before,
    "Machine filtering must preserve native source identity, geometry and stamps",
  );
} catch (error) {
  failures.push(error);
} finally {
  closing = true;
  for (const cleanup of [
    () => browser && stopFixtureChild(browser),
    () => daemon && stopFixtureChild(daemon),
    () => fleet.dispose(),
  ]) {
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
}
if (fatal && !failures.includes(fatal)) failures.push(fatal);
if (failures.length) throw new AggregateError(failures, "Home machine-filter fixture failed");
console.log(
  JSON.stringify({
    passed: true,
    packaged: app !== undefined,
    sessions: 2,
    machineSelectedAndCleared: true,
    staleRevisionRefused: true,
    sameConnection: true,
    attentionScopeRetained: true,
    homeAndAttentionContext: true,
    sourceIdentityGeometryAndStampsUnchanged: true,
    noPromotion: true,
    multipleMachinesAndRemovalTested: false,
    ownedCleanup: true,
    nativeUi: false,
  }),
);
