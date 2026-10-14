import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAttentionOwner,
  attentionObserveSchema,
  openAttentionAgentSchema,
} from "./attention.ts";
import { createSharedAgentObservation } from "./shared-agent-observation.ts";
import type {
  HomeAgentSnapshot,
  HomeAgentRow,
} from "../../../packages/presentation/src/home-agent-roster.ts";
const row: HomeAgentRow = {
  key: "opaque",
  sessionKey: "session",
  sessionName: "Workspace",
  liveSessionId: "live",
  daemonInstanceId: "generation",
  agentId: "agent",
  paneId: "pane",
  name: "Same name",
  harness: "codex",
  activity: "waiting",
  attention: true,
  projectName: "",
  nativeIdentity: { serverEpoch: "00000000-0000-4000-8000-000000000001", paneBirthId: "1" },
  interactionEndpoint: null,
};
const snapshot: HomeAgentSnapshot = {
  phase: "live",
  rows: [row, { ...row, key: "failed-but-not-attention", attention: false, activity: "failed" }],
  observedSessions: 1,
  totalSessions: 1,
  loadingSessions: 0,
  unavailableSessions: 0,
  truncatedSessions: 0,
  refreshingSessionKeys: [],
  unavailableSessionKeys: [],
  note: null,
};
const observe = (scope: number, active = true, request = 0) =>
  attentionObserveSchema.parse({ type: "attention-observe", request, scope, active });
test("attention scopes fence callbacks, stale closes and replay without changing caller surface", () => {
  const callbacks: Array<(value: HomeAgentSnapshot) => void> = [];
  let stopped = 0;
  const fleet = {
    observeAgents(fn: (value: HomeAgentSnapshot) => void) {
      callbacks.push(fn);
      return () => {
        stopped++;
      };
    },
    resolveAgent: () => null,
  };
  const owner = createAttentionOwner(() => {});
  owner.observe(observe(1), 0, true, fleet);
  callbacks[0]!(snapshot);
  assert.deepEqual(
    owner.publication()?.rows.map((r) => r.key),
    ["opaque"],
  );
  owner.observe(observe(2), 0, true, fleet);
  const loading = owner.publication();
  callbacks[0]!(snapshot);
  assert.equal(owner.publication(), loading);
  owner.observe(observe(1, false), 0, true, fleet);
  assert.equal(owner.publication()?.scope, 2);
  owner.cancel();
  callbacks[1]!(snapshot);
  assert.equal(owner.publication(), null);
  owner.observe(observe(2), 0, true, fleet);
  owner.observe(observe(3), 0, false, fleet);
  assert.equal(owner.publication(), null);
  owner.observe(observe(3, true, 0), 1, true, fleet);
  assert.equal(owner.publication(), null);
  owner.observe(observe(3, true, 1), 1, true, fleet);
  assert.equal(owner.publication()?.scope, 3);
  owner.cancel();
  assert.equal(stopped, 3);
});
test("private host reports unavailable; malformed commands cannot widen scope", () => {
  const owner = createAttentionOwner(() => {});
  owner.observe(observe(1), 0, true, undefined);
  assert.equal(owner.publication()?.phase, "unavailable");
  assert.deepEqual(owner.publication()?.rows, []);
  for (const scope of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      attentionObserveSchema.safeParse({
        type: "attention-observe",
        request: 0,
        scope,
        active: true,
      }).success,
      false,
    );
  assert.equal(
    openAttentionAgentSchema.safeParse({
      type: "open-attention-agent",
      request: 1,
      fromRequest: 0,
      scope: 1,
      rosterRevision: 1,
      key: "opaque",
      extra: true,
    }).success,
    false,
  );
  owner.cancel();
});
test("Home and attention share one source; closing either cannot retire the other's rows", () => {
  let starts = 0,
    stops = 0;
  const callbacks: Array<(value: HomeAgentSnapshot) => void> = [];
  const shared = createSharedAgentObservation((publish) => {
    starts++;
    callbacks.push(publish);
    publish(snapshot);
    return () => {
      stops++;
    };
  });
  const home: HomeAgentSnapshot[] = [];
  const attention: HomeAgentSnapshot[] = [];
  const stopHome = shared.subscribe((value) => home.push(value));
  const stopAttention = shared.subscribe((value) => attention.push(value));
  assert.equal(starts, 1);
  assert.equal(attention[0], snapshot);
  stopAttention();
  callbacks[0]!({ ...snapshot, phase: "partial" });
  assert.equal(home.length, 2);
  assert.equal(attention.length, 1);
  assert.equal(stops, 0);
  stopHome();
  assert.equal(stops, 1);
  const next: HomeAgentSnapshot[] = [];
  shared.subscribe((value) => next.push(value));
  assert.equal(starts, 2);
  callbacks[0]!({ ...snapshot, phase: "unavailable" });
  assert.equal(next.length, 1);
  shared.dispose();
  assert.equal(stops, 2);
});

test("activation uses only current attention scope/revision and exact live opaque route", () => {
  let publish!: (value: HomeAgentSnapshot) => void;
  let valid = true;
  const target = { row, machineId: "local", selection: "route" };
  const fleet = {
    observeAgents(fn: typeof publish) {
      publish = fn;
      return () => {};
    },
    resolveAgent: (key: string) => (valid && key === row.key ? target : null),
  };
  const owner = createAttentionOwner(() => {});
  owner.observe(observe(1), 0, true, fleet);
  publish(snapshot);
  const command = openAttentionAgentSchema.parse({
    type: "open-attention-agent",
    request: 1,
    fromRequest: 0,
    scope: 1,
    rosterRevision: owner.publication()!.revision,
    key: row.key,
  });
  assert.equal(owner.resolve(command, 0, true, fleet), target);
  for (const change of [
    { scope: 2 },
    { rosterRevision: command.rosterRevision + 1 },
    { fromRequest: 1 },
    { key: "failed-but-not-attention" },
    { request: 0 },
  ])
    assert.equal(owner.resolve({ ...command, ...change }, 0, true, fleet), null);
  assert.equal(owner.resolve(command, 0, false, fleet), null);
  valid = false;
  assert.equal(owner.resolve(command, 0, true, fleet), null);
  valid = true;
  publish({ ...snapshot, rows: [] });
  assert.equal(owner.resolve(command, 0, true, fleet), null);
  for (const phase of ["loading", "unavailable", "partial", "live"] as const) {
    publish({ ...snapshot, phase });
    const fresh = { ...command, rosterRevision: owner.publication()!.revision };
    assert.equal(
      owner.resolve(fresh, 0, true, fleet),
      phase === "partial" || phase === "live" ? target : null,
    );
  }
  owner.cancel();
  assert.equal(owner.resolve(command, 0, true, fleet), null);
});

test("rejected activation attempts cannot be replayed after a later observation", () => {
  const owner = createAttentionOwner(() => {});
  assert.equal(owner.admitAttempt(3, 2), true);
  owner.cancel();
  assert.equal(owner.admitAttempt(3, 2), false);
  assert.equal(owner.admitAttempt(2, 2), false);
  assert.equal(owner.admitAttempt(4, 2), true);
  assert.equal(owner.admitAttempt(5, 6), false);
  assert.equal(owner.admitAttempt(7, 6), true);
});
