import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkspaceFleetAgents,
  workspaceAgentRows,
  openWorkspaceFleetAgentSchema,
} from "./workspace-fleet-agents.ts";
import type {
  HomeAgentRow,
  HomeAgentSnapshot,
} from "../../../packages/presentation/src/home-agent-roster.ts";
const row: HomeAgentRow = {
  key: "one",
  machineId: "local",
  server: { serverId: "server-a", generation: "generation-a" },
  sessionKey: "session",
  sessionName: "Same",
  liveSessionId: "live",
  daemonInstanceId: "generation",
  agentId: "agent",
  paneId: "pane",
  name: "Same",
  harness: "codex",
  activity: "running",
  attention: false,
  projectName: "",
  nativeIdentity: { serverEpoch: "00000000-0000-4000-8000-000000000001", paneBirthId: "1" },
  interactionEndpoint: null,
};
const snapshot: HomeAgentSnapshot = {
  phase: "live",
  rows: [row, { ...row, key: "two", machineId: "remote" }],
  observedSessions: 2,
  totalSessions: 3,
  loadingSessions: 0,
  unavailableSessions: 0,
  truncatedSessions: 1,
  refreshingSessionKeys: [],
  unavailableSessionKeys: [],
  note: "Some sessions remain unobserved",
};
function fixture() {
  const callbacks: Array<(value: HomeAgentSnapshot) => void> = [];
  let stops = 0,
    live = true;
  const fleet = {
    observeWorkspaceAgents(fn: (value: HomeAgentSnapshot) => void) {
      callbacks.push(fn);
      return () => {
        stops++;
      };
    },
    resolveAgent(key: string) {
      const r = snapshot.rows.find((row) => row.key === key);
      return live && r ? { row: r, machineId: r.machineId!, selection: "private-route" } : null;
    },
  };
  const owner = createWorkspaceFleetAgents(() => {}),
    route = {};
  const selected = (r: HomeAgentRow) => r.machineId === "local";
  owner.sync(3, route, true, fleet, selected);
  return {
    owner,
    fleet,
    route,
    selected,
    callbacks,
    stops: () => stops,
    retire: () => {
      live = false;
    },
  };
}
test("Workspace lifecycle scopes snapshots and exact selected key without duplicate subscriptions", () => {
  const f = fixture();
  f.callbacks[0]!(snapshot);
  assert.equal(f.owner.publication()!.selectedKey, "one");
  assert.equal(f.owner.publication()!.truncatedSessions, 1);
  const initial = f.owner.publication()!;
  f.owner.sync(3, f.route, true, f.fleet, f.selected);
  assert.equal(f.callbacks.length, 1);
  f.owner.sync(3, f.route, false, f.fleet, f.selected);
  assert.equal(f.owner.publication(), null);
  assert.equal(f.stops(), 1);
  f.callbacks[0]!(snapshot);
  assert.equal(f.owner.publication(), null);
  f.owner.sync(3, f.route, true, f.fleet, f.selected);
  f.callbacks[1]!(snapshot);
  assert.ok(f.owner.publication()!.scope > initial.scope);
  f.owner.sync(4, {}, true, f.fleet, f.selected);
  assert.equal(f.stops(), 2);
  f.callbacks[1]!(snapshot);
  assert.equal(f.owner.publication()!.phase, "loading");
  f.owner.cancel();
});
test("activation preserves scope/revision/key admission and freshly revalidates retained target", () => {
  const f = fixture();
  f.callbacks[0]!(snapshot);
  const pub = f.owner.publication()!;
  const command = {
    type: "open-workspace-fleet-agent" as const,
    request: 4,
    fromRequest: 3,
    scope: pub.scope,
    rosterRevision: pub.revision,
    key: "two",
  };
  assert.equal(f.owner.resolve(command, 3, true, f.fleet)!.machineId, "remote");
  for (const change of [
    { fromRequest: 2 },
    { scope: pub.scope + 1 },
    { rosterRevision: pub.revision + 1 },
    { key: "unknown" },
  ])
    assert.equal(f.owner.resolve({ ...command, ...change }, 3, true, f.fleet), null);
  assert.equal(f.owner.resolve(command, 3, false, f.fleet), null);
  f.callbacks[0]!({ ...snapshot, phase: "unavailable" });
  assert.equal(
    f.owner.resolve(
      { ...command, rosterRevision: f.owner.publication()!.revision },
      3,
      true,
      f.fleet,
    ),
    null,
  );
  f.callbacks[0]!(snapshot);
  f.retire();
  assert.equal(
    f.owner.resolve(
      { ...command, rosterRevision: f.owner.publication()!.revision },
      3,
      true,
      f.fleet,
    ),
    null,
  );
  f.owner.cancel();
  assert.equal(f.owner.resolve(command, 3, true, f.fleet), null);
});
test("private hosts retain fallback and selected row is null when clipped or ambiguous", () => {
  const f = fixture();
  f.owner.sync(3, f.route, true, undefined, f.selected);
  assert.equal(f.owner.publication(), null);
  f.owner.sync(3, f.route, true, f.fleet, () => true);
  f.callbacks[1]!(snapshot);
  assert.equal(f.owner.publication()!.selectedKey, null);
  f.owner.sync(3, f.route, true, f.fleet, (r) => r.key === "last");
  f.callbacks[1]!({
    ...snapshot,
    rows: [
      ...Array.from({ length: 256 }, (_, i) => ({ ...row, key: `row-${i}` })),
      { ...row, key: "last" },
    ],
  });
  assert.equal(f.owner.publication()!.rows.length, 256);
  assert.equal(f.owner.publication()!.truncatedRows, 1);
  assert.equal(f.owner.publication()!.selectedKey, null);
});
test("membership grouping uses exact machine/server/generation/team identity, never duplicate labels", () => {
  const team = { id: "team.abcdefghijklmnop", name: "Same", source: "manual" as const };
  const values = [
    { ...row, key: "ungrouped" },
    { ...row, key: "a1", team },
    { ...row, key: "b", team, server: { serverId: "server-b", generation: "generation-a" } },
    { ...row, key: "a2", team },
    {
      ...row,
      key: "replacement",
      team,
      server: { serverId: "server-a", generation: "generation-b" },
    },
    { ...row, key: "remote", team, machineId: "remote" },
  ];
  assert.deepEqual(
    workspaceAgentRows(values).map((r) => r.key),
    ["a1", "a2", "b", "replacement", "ungrouped", "remote"],
  );
  assert.equal(
    openWorkspaceFleetAgentSchema.safeParse({
      type: "open-workspace-fleet-agent",
      request: 4,
      fromRequest: 3,
      scope: 1,
      rosterRevision: 1,
      key: "one",
      machineId: "remote",
    }).success,
    false,
  );
});

test("selected highlight rejects retired or replaced native and daemon identities before a roster update", () => {
  const f = fixture();
  f.callbacks[0]!(snapshot);
  assert.equal(f.owner.publication()!.selectedKey, "one");
  const original = f.fleet.resolveAgent;
  for (const change of [
    { daemonInstanceId: "replacement" },
    { nativeIdentity: { ...row.nativeIdentity!, paneBirthId: "2" } },
    { agentId: "replacement-agent" },
  ]) {
    f.fleet.resolveAgent = (key) => {
      const target = original(key);
      return target ? { ...target, row: { ...target.row, ...change } } : null;
    };
    assert.equal(f.owner.publication()!.selectedKey, null);
  }
  f.fleet.resolveAgent = original;
  assert.equal(f.owner.publication()!.selectedKey, "one");
  f.retire();
  assert.equal(f.owner.publication()!.selectedKey, null);
  f.owner.cancel();
});
