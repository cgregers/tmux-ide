// Private real-daemon Empty fleet-server qualification; no GUI or generated CLI build.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import process from "node:process";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createScratchFleet } from "../../../scripts/lib/product-fixtures/scratch-fleet.ts";
import {
  registerTmuxServer,
  createTmuxServerClient,
} from "../../../packages/daemon-client/src/tmux-server-client.ts";
import { stopFixtureChild } from "./fixture-child.mjs";

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
  slug: "fleet-server",
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
const clients = [];
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
      "Empty fleet-server fixture deadline: " +
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
const sockets = [join(fleet.root, "empty-a.sock"), join(fleet.root, "empty-b.sock")];
const createdSockets = [];
const at = (socket, ...args) =>
  execFileSync(env.TMUX_IDE_TMUX_BIN, ["-S", socket, ...args], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });
const sessionNames = (socket) => {
  // An empty retained server can answer list-sessions with status 1. Prove
  // the exact server is still alive before interpreting that response as empty.
  assert.equal(at(socket, "show-options", "-s", "-v", "exit-empty").trim(), "off");
  try {
    return at(socket, "list-sessions", "-F", "#{session_name}").split("\n").filter(Boolean);
  } catch (error) {
    if (error.status === 1 && String(error.stderr).trim() === "no sessions") return [];
    throw error;
  }
};
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
try {
  const before = source();
  for (const socket of sockets) {
    // Register ownership before startup so cleanup covers partial command failure.
    createdSockets.push(socket);
    at(socket, "-f", "/dev/null", "new-session", "-d", "-s", "bootstrap");
    at(socket, "set-option", "-s", "exit-empty", "off");
    at(socket, "kill-session", "-t", "=bootstrap");
    assert.deepEqual(sessionNames(socket), []);
  }
  daemon = ownChild(spawn(process.execPath, [cli, "--headless"], { env, stdio: "ignore" }));
  let record;
  await until(async () => {
    try {
      record = JSON.parse(await readFile(fleet.daemonInfoDir + "/daemon.json", "utf8"));
      return record.pid === daemon.pid;
    } catch {
      return false;
    }
  });
  const options = { baseUrl: `http://127.0.0.1:${record.port}/`, ownerToken: record.authToken };
  const servers = [];
  for (const socket of sockets) {
    const server = await registerTmuxServer(options, {
      label: "Duplicate empty server",
      selector: { kind: "path", path: socket },
    });
    assert.equal(server.state, "online");
    assert.ok(server.generation);
    servers.push(server);
  }
  assert.notEqual(servers[0].serverId, servers[1].serverId);
  clients.push(
    ...servers.map(({ serverId, generation }) =>
      createTmuxServerClient(options, { serverId, generation }),
    ),
  );
  for (const client of clients) assert.deepEqual((await client.sessions()).sessions, []);
  const receiptPath = join(fleet.root, "creation-receipt.json");
  // Test-only observation of the supported response, without changing request or response bytes.
  const observer =
    "data:text/javascript," +
    encodeURIComponent(`
    import { writeFile } from 'node:fs/promises';
    const original = globalThis.fetch;
    globalThis.fetch = async (...args) => {
      const response = await original(...args);
      if (new URL(typeof args[0] === 'string' ? args[0] : args[0].url ?? args[0]).pathname === ${JSON.stringify(`/api/v1/tmux-servers/${encodeURIComponent(servers[1].serverId)}/${encodeURIComponent(servers[1].generation)}/sessions/create`)} && response.ok) {
        const {displayName, liveSessionId, workspaceName, daemonInstanceId} = await response.clone().json();
        await writeFile(${JSON.stringify(receiptPath)}, JSON.stringify({displayName, liveSessionId, workspaceName, daemonInstanceId}), {mode:0o600});
      }
      return response;
    };
  `);
  browser = ownChild(
    spawn(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        "--import",
        observer,
        fileURLToPath(new URL("./browser.ts", import.meta.url)),
        "--local",
      ],
      { env, stdio: ["pipe", "pipe", "pipe"] },
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
  const descriptors = () =>
    latest?.fleet?.groups?.find((group) => group.id === "local")?.servers ?? [];
  await until(
    () =>
      latest?.presenceRevision === 1 &&
      servers.every((server) =>
        descriptors().some(
          (row) =>
            row.id === server.serverId && row.generation === server.generation && row.selection,
        ),
      ),
  );
  const second = descriptors().find((row) => row.id === servers[1].serverId);
  const first = descriptors().find((row) => row.id === servers[0].serverId);
  assert.equal(first.label, second.label);
  const request = latest.request + 1;
  send({ type: "fleet-server", request, selection: second.selection });
  await until(
    () =>
      latest?.request === request &&
      latest.surface === "home" &&
      latest.home?.phase === "live" &&
      latest.selectedServer?.serverId === servers[1].serverId &&
      latest.selectedServer?.generation === servers[1].generation &&
      latest.createSession?.phase === "idle",
  );
  assert.deepEqual(latest.sessions, []);
  assert.equal(latest.snapshot, null);
  assert.equal(latest.inputReady, false);
  const revision = latest.createSession.revision;
  const name = "Created on second empty server";
  send({ type: "create-session", request, name });
  await until(
    () =>
      latest?.request === request &&
      latest.createSession?.revision > revision &&
      latest.createSession.phase !== "pending",
  );
  assert.equal(latest.createSession.phase, "idle", "Creation must succeed");
  assert.equal(latest.selectedServer.serverId, servers[1].serverId);
  assert.equal(latest.selectedServer.generation, servers[1].generation);
  assert.equal(latest.surface, "home");
  assert.deepEqual(sessionNames(sockets[0]), []);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.displayName, name);
  assert.equal(receipt.daemonInstanceId, servers[1].generation);
  assert.equal(typeof receipt.liveSessionId, "string");
  const created = (await clients[1].sessions()).sessions;
  assert.equal(created.length, 1);
  assert.equal(created[0].liveSessionId, receipt.liveSessionId);
  assert.equal(created[0].workspaceName, receipt.workspaceName);
  assert.deepEqual(sessionNames(sockets[1]), [created[0].sessionName]);
  assert.deepEqual(latest.sessions, [
    { id: receipt.liveSessionId, label: created[0].sessionName, paneCount: 1 },
  ]);
  assert.equal((await clients[0].sessions()).sessions.length, 0);
  assert.deepEqual(source(), before);
} catch (error) {
  failures.push(error);
} finally {
  closing = true;
  for (const cleanup of [
    () => browser && stopFixtureChild(browser),
    ...clients.map((client) => () => client.dispose()),
    () => daemon && stopFixtureChild(daemon),
    ...createdSockets.map((socket) => () => at(socket, "kill-server")),
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
if (failures.length) throw new AggregateError(failures, "Empty fleet-server fixture failed");
console.log(
  JSON.stringify({
    passed: true,
    genuinelyEmptyServers: 2,
    duplicateLabels: true,
    selectedSecondByIdentity: true,
    firstStillEmpty: true,
    sourceIdentityGeometryStampsUnchanged: true,
    exactCreationCount: 1,
    nativeUi: false,
    ownedCleanup: true,
  }),
);
