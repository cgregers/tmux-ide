// Real isolated browser/daemon admission check. Requires an explicit prebuilt CLI;
// does not rebuild generated bin/cli.js, open a GUI, or touch personal sessions.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { createScratchFleet } from "../../../../scripts/lib/product-fixtures/scratch-fleet.ts";
import { stopFixtureChild } from "../../bridge/fixture-child.mjs";
import {
  createTmuxServerClient,
  listTmuxServers,
} from "../../../../packages/daemon-client/src/tmux-server-client.ts";
const cli = process.env.TMUX_GPUI_TEST_CLI;
assert.ok(cli && isAbsolute(cli), "Provide absolute TMUX_GPUI_TEST_CLI");
for (const key of Object.keys(process.env))
  if (
    key.startsWith("TMUX_IDE_") ||
    ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(key)
  )
    delete process.env[key];
const fleet = await createScratchFleet({
  sessions: 1,
  windowsPerSession: 1,
  slug: "gpui-attention",
});
const env = { ...process.env, ...fleet.environment };
execFileSync(
  env.TMUX_IDE_TMUX_BIN,
  [
    "-S",
    fleet.socketPath,
    "set-option",
    "-p",
    "-t",
    fleet.initialPanes[0].paneId,
    "@agent_state",
    "blocked:" + Math.floor(Date.now() / 1000),
  ],
  { env },
);
let daemon,
  browser,
  latest,
  fatal,
  buffer = "",
  diagnosticBytes = 0;
const failures = [];
const until = async (predicate) => {
  const deadline = Date.now() + 25000;
  for (;;) {
    if (fatal) throw fatal;
    if (await predicate()) {
      if (fatal) throw fatal;
      return;
    }
    assert.ok(Date.now() < deadline, "private fixture deadline");
    await new Promise((r) => setTimeout(r, 20));
  }
};
try {
  daemon = spawn(process.execPath, [cli, "--headless"], {
    env,
    stdio: ["ignore", "ignore", "ignore"],
  });
  daemon.on("error", (e) => {
    fatal ??= e;
  });
  await until(async () => {
    try {
      return (
        JSON.parse(await readFile(fleet.daemonInfoDir + "/daemon.json", "utf8")).pid === daemon.pid
      );
    } catch {
      return false;
    }
  });
  browser = spawn(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      resolve("apps/tmux-gpui/bridge/browser.ts"),
      "--local",
    ],
    { env, stdio: ["pipe", "pipe", "pipe"] },
  );
  browser.on("error", (e) => {
    fatal ??= e;
  });
  browser.stdin.on("error", (e) => {
    fatal ??= e;
  });
  browser.stderr.on("data", (data) => {
    diagnosticBytes += data.length;
    if (diagnosticBytes > 65536) fatal ??= new Error("Diagnostics overflow");
  });
  browser.stdout.on("data", (data) => {
    try {
      buffer += data;
      assert.ok(Buffer.byteLength(buffer) <= 8 * 1024 * 1024);
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        latest = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
    } catch (e) {
      fatal ??= e;
    }
  });
  const send = (value) => browser.stdin.write(JSON.stringify(value) + "\n");
  await until(() => latest?.fleet?.groups.some((g) => g.sessions.some((s) => s.selection)));
  await until(() => latest?.homeAgents?.phase === "live" && latest.homeAgents.rows.length === 1);
  console.log(JSON.stringify({ stage: "before-open", agents: latest.homeAgents.rows }));
  const record = JSON.parse(await readFile(fleet.daemonInfoDir + "/daemon.json", "utf8"));
  const opts = {
    baseUrl: `http://${record.bindHostname}:${record.port}/`,
    ownerToken: record.authToken,
    hostClientId: "gpui-unpromoted-proof",
    origin: "tmux-ide://app",
  };
  const server = (await listTmuxServers(opts)).servers.find((s) => s.state === "online");
  const client = createTmuxServerClient(opts, {
    serverId: server.serverId,
    generation: server.generation,
  });
  try {
    const c = (await client.sessions()).sessions[0];
    const shell = await client.applicationShell(c.workspaceName ?? c.sessionName, c.liveSessionId);
    console.log(
      JSON.stringify({
        stage: "raw-before",
        inventory: shell.resource.terminalInventory,
        agents: shell.resource.workspace.sidebar.agents,
      }),
    );
  } finally {
    client.dispose();
  }
  const session = latest.fleet.groups.flatMap((g) => g.sessions).find((s) => s.selection);
  send({ type: "fleet-session", request: 1, selection: session.selection });
  await until(() => latest?.request === 1 && latest.preferredPane);
  send({ type: "pane", request: 2, id: latest.preferredPane });
  await until(() => latest?.request === 2 && latest.inputReady && latest.snapshot);
  const selectedPane = latest.selectedPane,
    selectedSession = latest.selectedSession,
    connection = latest.connection;
  const preserved = () => {
    assert.equal(latest.request, 2);
    assert.equal(latest.selectedPane, selectedPane);
    assert.equal(latest.selectedSession, selectedSession);
    assert.equal(latest.connection, connection);
    assert.equal(latest.inputReady, true);
    assert.ok(latest.snapshot);
  };
  send({ type: "attention-observe", request: 2, scope: 1, active: true });
  await until(
    () => latest?.attentionAgents?.scope === 1 && latest.attentionAgents.phase === "live",
  );
  console.log(JSON.stringify({ stage: "after-open", agents: latest.attentionAgents.rows }));
  const afterClient = createTmuxServerClient(opts, {
    serverId: server.serverId,
    generation: server.generation,
  });
  try {
    const c = (await afterClient.sessions()).sessions[0];
    const shell = await afterClient.applicationShell(c.workspaceName, c.liveSessionId);
    console.log(
      JSON.stringify({
        stage: "raw-after",
        inventory: shell.resource.terminalInventory,
        agents: shell.resource.workspace.sidebar.agents,
      }),
    );
  } finally {
    afterClient.dispose();
  }

  preserved();
  for (const [attempt, scope, revision, key] of [
    [3, 999, 1, "missing"],
    [4, 1, 999, "missing"],
    [5, 1, latest.attentionAgents.revision, "missing"],
  ]) {
    send({
      type: "open-attention-agent",
      request: attempt,
      fromRequest: 2,
      scope,
      rosterRevision: revision,
      key,
    });
    await until(() => latest?.attentionSelectionRejected?.request === attempt);
    assert.deepEqual(latest.attentionSelectionRejected, {
      request: attempt,
      fromRequest: 2,
      scope,
    });
    preserved();
  }
  send({ type: "attention-observe", request: 2, scope: 1, active: false });
  await until(() => latest?.attentionAgents === null);
  preserved();
} catch (error) {
  failures.push(error);
} finally {
  for (const cleanup of [
    () => browser && stopFixtureChild(browser),
    () => daemon && stopFixtureChild(daemon),
    () => fleet.dispose(),
  ])
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
}
if (fatal && !failures.includes(fatal)) failures.push(fatal);
if (failures.length) throw new AggregateError(failures, "Attention fixture failed");
console.log(
  JSON.stringify({
    passed: true,
    openingClosingPreservesWorkspace: true,
    invalidScopeRevisionKeyPreserveWorkspace: true,
    correlatedRejection: true,
    ownedCleanup: true,
    nativeUi: false,
  }),
);
