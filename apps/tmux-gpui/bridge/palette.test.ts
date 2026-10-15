import { test } from "node:test";
import assert from "node:assert/strict";
import { createPaletteOwner, paletteObserveSchema, openPaletteAgentSchema } from "./palette.ts";
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
  rows: [row, { ...row, key: "failed-but-not-palette", attention: false, activity: "failed" }],
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
  paletteObserveSchema.parse({ type: "palette-observe", request, scope, active });
test("palette scopes fence callbacks, stale closes and replay without changing caller surface", () => {
  const callbacks: Array<(value: HomeAgentSnapshot) => void> = [];
  let stopped = 0;
  const fleet = {
    observePaletteAgents(_query: string, fn: (value: HomeAgentSnapshot) => void) {
      callbacks.push(fn);
      return {
        update() {},
        dispose() {
          stopped++;
        },
      };
    },
    resolveAgent: () => null,
  };
  const owner = createPaletteOwner(() => {});
  owner.observe(observe(1), 0, true, fleet);
  callbacks[0]!(snapshot);
  assert.deepEqual(
    owner.publication()?.rows.map((r) => r.key),
    ["opaque", "failed-but-not-palette"],
  );
  owner.observe(observe(2), 0, true, fleet);
  const loading = owner.publication();
  assert.equal(owner.publication(), loading);
  owner.observe(observe(1, false), 0, true, fleet);
  assert.equal(owner.publication()?.scope, 2);
  owner.cancel();
  callbacks[0]!(snapshot);
  assert.equal(owner.publication(), null);
  owner.observe(observe(2), 0, true, fleet);
  owner.observe(observe(3), 0, false, fleet);
  assert.equal(owner.publication(), null);
  owner.observe(observe(3, true, 0), 1, true, fleet);
  assert.equal(owner.publication(), null);
  owner.observe(observe(3, true, 1), 1, true, fleet);
  assert.equal(owner.publication()?.scope, 3);
  owner.cancel();
  assert.equal(stopped, 2);
});
test("private host reports unavailable; malformed commands cannot widen scope", () => {
  const owner = createPaletteOwner(() => {});
  owner.observe(observe(1), 0, true, undefined);
  assert.equal(owner.publication()?.phase, "unavailable");
  assert.deepEqual(owner.publication()?.rows, []);
  for (const scope of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      paletteObserveSchema.safeParse({
        type: "palette-observe",
        request: 0,
        scope,
        active: true,
      }).success,
      false,
    );
  assert.equal(
    openPaletteAgentSchema.safeParse({
      type: "open-palette-agent",
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
test("Home and palette share one source; closing either cannot retire the other's rows", () => {
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
  const palette: HomeAgentSnapshot[] = [];
  const stopHome = shared.subscribe((value) => home.push(value));
  const stopPalette = shared.subscribe((value) => palette.push(value));
  assert.equal(starts, 1);
  assert.equal(palette[0], snapshot);
  stopPalette();
  callbacks[0]!({ ...snapshot, phase: "partial" });
  assert.equal(home.length, 2);
  assert.equal(palette.length, 1);
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

test("activation uses only current palette scope/revision and exact live opaque route", () => {
  let publish!: (value: HomeAgentSnapshot) => void;
  let valid = true;
  const target = { row, machineId: "local", selection: "route" };
  const fleet = {
    observePaletteAgents(_query: string, fn: typeof publish) {
      publish = fn;
      return { update() {}, dispose() {} };
    },
    resolveAgent: (key: string) => (valid && key === row.key ? target : null),
  };
  const owner = createPaletteOwner(() => {});
  owner.observe(observe(1), 0, true, fleet);
  publish(snapshot);
  const command = openPaletteAgentSchema.parse({
    type: "open-palette-agent",
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
    { key: "missing" },
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
  const owner = createPaletteOwner(() => {});
  assert.equal(owner.admitAttempt(3, 2), true);
  owner.cancel();
  assert.equal(owner.admitAttempt(3, 2), false);
  assert.equal(owner.admitAttempt(2, 2), false);
  assert.equal(owner.admitAttempt(4, 2), true);
  assert.equal(owner.admitAttempt(5, 6), false);
  assert.equal(owner.admitAttempt(7, 6), true);
});

test("query precedes cap, includes non-attention metadata and preserves observation coverage", () => {
  let publish!: (value: HomeAgentSnapshot) => void;
  let query = "";
  const fleet = {
    observePaletteAgents(value: string, fn: typeof publish) {
      query = value;
      publish = fn;
      return { update() {}, dispose() {} };
    },
    resolveAgent: () => null,
  };
  const owner = createPaletteOwner(() => {});
  owner.observe(
    paletteObserveSchema.parse({
      type: "palette-observe",
      request: 0,
      scope: 1,
      active: true,
      query: "agent zebra",
    }),
    0,
    true,
    fleet,
  );
  assert.equal(query, "agent zebra");
  const rows = Array.from({ length: 300 }, (_, i) => ({
    ...row,
    key: `row-${i}`,
    attention: false,
    projectName: i === 299 ? "Zebra" : "Ordinary",
  }));
  publish({ ...snapshot, rows, totalSessions: 33, observedSessions: 32, truncatedSessions: 1 });
  assert.deepEqual(
    owner.publication()?.rows.map((r) => r.key),
    ["row-299"],
  );
  assert.equal(owner.publication()?.truncatedSessions, 1);
  owner.observe(
    paletteObserveSchema.parse({ type: "palette-observe", request: 0, scope: 2, active: true }),
    0,
    true,
    fleet,
  );
  publish({ ...snapshot, rows });
  assert.equal(owner.publication()?.rows.length, 256);
  assert.equal(owner.publication()?.truncatedRows, 44);
  const command = {
    type: "palette-observe",
    request: 0,
    scope: 3,
    active: true,
    query: "😀".repeat(256),
  };
  assert.equal(paletteObserveSchema.safeParse(command).success, true);
  assert.equal(
    paletteObserveSchema.safeParse({ ...command, query: command.query + "a" }).success,
    false,
  );
  owner.cancel();
});

test("higher query scope updates the sole subscription without teardown and fences old activation", () => {
  let starts = 0,
    stops = 0,
    updates = 0;
  let callback!: (value: HomeAgentSnapshot) => void;
  const fleet = {
    observePaletteAgents(_query: string, fn: typeof callback) {
      starts++;
      callback = fn;
      fn(snapshot);
      return {
        update() {
          updates++;
          fn(snapshot);
        },
        dispose() {
          stops++;
        },
      };
    },
    resolveAgent: () => ({ row, machineId: "local", selection: "route" }),
  };
  const owner = createPaletteOwner(() => {});
  owner.observe(observe(1), 0, true, fleet);
  const old = openPaletteAgentSchema.parse({
    type: "open-palette-agent",
    request: 1,
    fromRequest: 0,
    scope: 1,
    rosterRevision: owner.publication()!.revision,
    key: row.key,
  });
  owner.observe({ ...observe(2), query: "agent same" }, 0, true, fleet);
  assert.deepEqual({ starts, stops, updates }, { starts: 1, stops: 0, updates: 1 });
  assert.equal(owner.publication()?.scope, 2);
  assert.equal(owner.resolve(old, 0, true, fleet), null);
  const revision = owner.publication()!.revision;
  callback({ ...snapshot, rows: [{ ...row, name: "Different" }] });
  assert.equal(owner.publication()?.scope, 2);
  assert.ok(owner.publication()!.revision > revision);
  assert.deepEqual(owner.publication()?.rows, []);
  owner.cancel();
  callback(snapshot);
  assert.equal(owner.publication(), null);
  assert.equal(stops, 1);
});
