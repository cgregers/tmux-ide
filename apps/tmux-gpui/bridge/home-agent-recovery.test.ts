import { test } from "node:test";
import assert from "node:assert/strict";
import { createHomeAgentRecovery } from "./home-agent-recovery.ts";
import { createSharedAgentObservation } from "./shared-agent-observation.ts";
import type { HomeAgentSnapshot } from "../../../packages/presentation/src/home-agent-roster.ts";
const snapshot: HomeAgentSnapshot = {
  phase: "partial",
  rows: [],
  observedSessions: 1,
  totalSessions: 40,
  loadingSessions: 0,
  unavailableSessions: 1,
  truncatedSessions: 8,
  refreshingSessionKeys: [],
  unavailableSessionKeys: [],
  note: null,
};
const current = { request: 0, home: true, foreground: true };
const command = { type: "home-agent-recovery", request: 0, rosterRevision: 1, action: "load-more" };
test("recovery consumes exact publication once and refuses stale/background/non-Home actions", () => {
  const owner = createHomeAgentRecovery();
  let calls = 0;
  owner.adopt(snapshot, 1);
  for (const state of [
    { ...current, request: 1 },
    { ...current, foreground: false },
    { ...current, home: false },
  ])
    assert.equal(
      owner.command(command, state, () => calls++),
      false,
    );
  assert.equal(
    owner.command({ ...command, rosterRevision: 2 }, current, () => calls++),
    false,
  );
  assert.equal(
    owner.command(command, current, () => calls++),
    true,
  );
  assert.equal(
    owner.command({ ...command, action: "retry" }, current, () => calls++),
    false,
  );
  assert.equal(calls, 1);
  assert.equal(owner.publication()?.canLoadMore, false);
  owner.adopt(snapshot, 2);
  assert.equal(
    owner.command({ ...command, rosterRevision: 2, action: "retry" }, current, () => calls++),
    true,
  );
  owner.clear();
  assert.equal(owner.publication(), null);
});
test("session pagination is distinct from row truncation and successful empty observation", () => {
  const owner = createHomeAgentRecovery();
  owner.adopt({ ...snapshot, rows: Array(256).fill({}) }, 1);
  assert.equal(owner.publication()?.canLoadMore, true);
  owner.adopt({ ...snapshot, phase: "live", truncatedSessions: 0, unavailableSessions: 0 }, 2);
  assert.deepEqual(owner.publication(), { revision: 2, canRetry: false, canLoadMore: false });
});
test("recovery retains Home and attention subscribers without restarting their shared scan", () => {
  let starts = 0,
    stops = 0;
  let emit: (s: HomeAgentSnapshot) => void = () => {};
  const shared = createSharedAgentObservation((publish) => {
    starts++;
    emit = publish;
    return () => stops++;
  });
  const owner = createHomeAgentRecovery();
  let revision = 0,
    attention = 0;
  const stopHome = shared.subscribe((s) => owner.adopt(s, ++revision));
  const stopAttention = shared.subscribe(() => attention++);
  emit(snapshot);
  assert.equal(
    owner.command(command, current, () => emit({ ...snapshot, truncatedSessions: 0 })),
    true,
  );
  assert.equal(attention, 2);
  assert.equal(starts, 1);
  assert.equal(stops, 0);
  assert.equal(owner.publication()?.revision, 2);
  stopHome();
  assert.equal(stops, 0);
  stopAttention();
  assert.equal(stops, 1);
});
