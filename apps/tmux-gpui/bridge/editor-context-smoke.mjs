// Real authenticated read path on a disposable daemon and tmux server.
import assert from "node:assert/strict";
import process from "node:process";
import console from "node:console";
import { execFileSync } from "node:child_process";
import { mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { createScratchFleet } from "../../../scripts/lib/product-fixtures/scratch-fleet.ts";
import { startDaemon } from "../../../scripts/lib/product-fixtures/daemon.ts";
import {
  createTmuxServerClient,
  listTmuxServers,
} from "../../../packages/daemon-client/src/tmux-server-client.ts";

for (const key of Object.keys(process.env)) {
  if (
    key.startsWith("TMUX_IDE_") ||
    ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(key)
  )
    delete process.env[key];
}
const fleet = await createScratchFleet({
  sessions: 1,
  windowsPerSession: 1,
  slug: "editor-context",
});
const tmux = (...args) =>
  execFileSync(fleet.environment.TMUX_IDE_TMUX_BIN, ["-S", fleet.socketPath, ...args], {
    env: { ...process.env, ...fleet.environment },
    encoding: "utf8",
    timeout: 5000,
  }).replace(/\n$/u, "");
let daemon, client;
const failures = [];
try {
  daemon = await startDaemon(fleet);
  const options = {
    baseUrl: daemon.baseUrl + "/",
    ownerToken: daemon.record.authToken,
    hostClientId: "gpui-editor-context",
    origin: "tmux-ide://app",
  };
  const server = (await listTmuxServers(options)).servers.find((entry) => entry.state === "online");
  assert.ok(server);
  const scope = { serverId: server.serverId, generation: server.generation };
  client = createTmuxServerClient(options, scope);
  const session = (await client.sessions()).sessions[0];
  assert.ok(session);
  const opened = await client.openSession(session.liveSessionId);
  const ids = (await client.inventory(opened.workspaceName)).resource.semanticPaneIds;
  assert.equal(ids.length, 1);
  const target = {
    generation: scope.generation,
    workspaceName: opened.workspaceName,
    liveSessionId: session.liveSessionId,
    semanticPaneId: ids[0],
  };
  const pane = fleet.initialPanes[0].paneId;
  const capture = () => tmux("capture-pane", "-p", "-t", pane);
  const before = capture();
  const observed = await client.paneEditorContext(target);
  assert.equal(
    observed.context.directory,
    tmux("display-message", "-p", "-t", pane, "#{pane_current_path}"),
  );
  assert.equal(capture(), before, "read must not type into the pane");
  const url = `${daemon.baseUrl}/api/v1/tmux-servers/${scope.serverId}/${scope.generation}/pane-editor-context`;
  const raw = (body, authenticated = true) =>
    globalThis.fetch(url, {
      method: "POST",
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { Authorization: `Bearer ${options.ownerToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const unauthenticated = await raw(target, false);
  assert.equal(unauthenticated.status, 401);
  const stale = await raw({ ...target, generation: randomUUID() });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: { code: "stale-generation" } });
  const changedDir = join(fleet.projectDir, "live folder 界");
  await mkdir(changedDir);
  const expectedDir = await realpath(changedDir);
  // Setup uses ASCII input: macOS sh's C-locale readline mangles typed UTF-8.
  // This private directory has exactly one matching child. The API still reads
  // and returns its real Unicode cwd; keyboard encoding is a separate journey.
  fleet.typeInPane(
    fleet.sessionNames[0],
    `cd '${fleet.projectDir.replaceAll("'", "'\\''")}'/live*`,
  );
  const deadline = Date.now() + 10000;
  while (tmux("display-message", "-p", "-t", pane, "#{pane_current_path}") !== expectedDir) {
    assert.ok(
      Date.now() < deadline,
      JSON.stringify({
        message: "owned shell did not change directory",
        expectedDir,
        actual: tmux("display-message", "-p", "-t", pane, "#{pane_current_path}"),
        capture: capture(),
      }),
    );
    await setTimeout(25);
  }
  assert.equal(
    (await client.paneEditorContext(target)).context.directory,
    expectedDir,
    "editor context must follow live cwd rather than saved layout cwd",
  );
  client.dispose();
  await assert.rejects(() => client.paneEditorContext(target));
  assert.equal(fleet.countPanes(fleet.sessionNames[0]), 1);
} catch (error) {
  failures.push(error);
} finally {
  for (const cleanup of [() => client?.dispose(), () => daemon?.stop(), () => fleet.dispose()]) {
    try {
      await cleanup();
    } catch (error) {
      failures.push(error);
    }
  }
}
if (failures.length) throw new AggregateError(failures, "Editor context smoke failed");
console.log(
  JSON.stringify({
    passed: true,
    authenticatedRead: true,
    liveUnicodeCwd: true,
    generationMismatchRejected: true,
    disposedClientRejected: true,
    noReadInput: true,
    cleanup: true,
  }),
);
