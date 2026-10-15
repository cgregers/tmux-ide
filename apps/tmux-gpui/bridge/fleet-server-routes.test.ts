import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createFleetServerRoutes } from "./fleet-server-routes.ts";
import type { MachineConnectionManager } from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import type { TmuxServerDescriptor } from "../../../packages/contracts/src/tmux-server-scope.ts";

function fixture() {
  let epoch = 1;
  let instanceId = randomUUID();
  const handle = {
    id: "local",
    endpoint: () => ({ state: "ready", epoch }),
    read: () => ({ instanceId, startedAt: "now" }),
  };
  let currentHandle: unknown = handle;
  const routes = createFleetServerRoutes({
    getMachine: () => currentHandle,
  } as unknown as MachineConnectionManager);
  const server: TmuxServerDescriptor = {
    serverId: `tmux-server.${randomUUID().replaceAll("-", "")}`,
    generation: randomUUID(),
    label: "Same label",
    state: "online",
  };
  const project = (servers: TmuxServerDescriptor[], enabled = true) => {
    routes.begin();
    const result = routes.project("local", "Local", enabled, servers);
    routes.finish();
    return result;
  };
  return {
    routes,
    server,
    project,
    replace: () => {
      currentHandle = { ...handle };
    },
    changeEpoch: () => epoch++,
    changeDaemon: () => {
      instanceId = randomUUID();
    },
  };
}

test("empty online servers have distinct exact routes despite duplicate labels; offline never does", () => {
  const f = fixture();
  const other = { ...f.server, serverId: `tmux-server.${randomUUID().replaceAll("-", "")}` };
  const rows = f.project([
    f.server,
    other,
    { ...f.server, serverId: "offline", state: "offline", generation: null },
  ]).servers;
  assert.ok(rows[0]!.selection);
  assert.notEqual(rows[0]!.selection, rows[1]!.selection);
  assert.equal(rows[2]!.selection, null);
  const selected = f.routes.resolve(rows[1]!.selection!);
  assert.equal(selected.descriptor.serverId, other.serverId);
  selected.assertCurrent();
  selected.descriptor.serverId = "caller mutation";
  assert.equal(f.routes.resolve(rows[1]!.selection!).descriptor.serverId, other.serverId);
  assert.equal(JSON.stringify(rows).includes("startedAt"), false);
});

test("server route refuses generation/endpoint/daemon/handle replacement and removed/offline scopes", () => {
  for (const change of [
    "generation",
    "epoch",
    "daemon",
    "handle",
    "removed",
    "offline",
    "disabled",
  ] as const) {
    const f = fixture();
    const token = f.project([f.server]).servers[0]!.selection!;
    const selected = f.routes.resolve(token);
    if (change === "generation") f.project([{ ...f.server, generation: randomUUID() }]);
    if (change === "epoch") f.changeEpoch();
    if (change === "daemon") f.changeDaemon();
    if (change === "handle") f.replace();
    if (change === "removed") f.project([]);
    if (change === "offline") f.project([{ ...f.server, state: "offline", generation: null }]);
    if (change === "disabled") f.project([f.server], false);
    assert.throws(selected.assertCurrent, /changed/, change);
    assert.throws(() => f.routes.resolve(token), /changed/, change);
    f.routes.dispose();
  }
});

test("server projection globally bounds rows and refuses ambiguous IDs", () => {
  const f = fixture();
  assert.equal(
    f.project([f.server, f.server]).servers.every((row) => row.selection === null),
    true,
  );
  f.routes.begin();
  let total = 0;
  for (let i = 0; i < 8; i++) {
    const row = f.routes.project(
      "local",
      "Local",
      true,
      Array.from({ length: 40 }, (_, n) => ({ ...f.server, serverId: `${i}-${n}` })),
    );
    assert.ok(row.servers.length <= 32);
    assert.equal(row.omittedServers, 40 - row.servers.length);
    total += row.servers.length;
  }
  assert.equal(total, 128);
  f.routes.finish();
});
