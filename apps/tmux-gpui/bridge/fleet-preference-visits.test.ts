import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createFleetPreferences,
  type VerifiedLocalFleetPreferenceOwner,
} from "./fleet-preferences.ts";
import {
  changeFleetClientState,
  emptyFleetClientState,
} from "../../../packages/core/src/fleet-client-state.ts";
import { FleetClientStateRequestSchema } from "../../../packages/contracts/src/fleet-client-state.ts";

function fixture() {
  const daemon = {
    protocolVersion: 1,
    productVersion: "test",
    instanceId: randomUUID(),
    startedAt: new Date().toISOString(),
  };
  let state = emptyFleetClientState();
  const writes: unknown[] = [];
  let hold: Promise<void> | undefined;
  const owner: VerifiedLocalFleetPreferenceOwner = {
    kind: "local",
    instanceId: daemon.instanceId,
    startedAt: daemon.startedAt,
    assertCurrent() {},
    async request(input) {
      if (input.body) {
        const change = FleetClientStateRequestSchema.parse(JSON.parse(input.body)).change;
        writes.push(change);
        state = changeFleetClientState(state, change);
      }
      const wait = hold;
      hold = undefined;
      await wait;
      return Response.json({ daemon, state });
    },
  };
  let selected = owner;
  const preferences = createFleetPreferences({ getLocalOwner: () => selected });
  return {
    preferences,
    writes,
    replace() {
      selected = { ...owner };
    },
    hold() {
      let resolve!: () => void, reject!: (error: Error) => void;
      hold = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      return { resolve, reject };
    },
  };
}

test("accepted visits serialize behind favorite saves and persist in arrival order", async () => {
  const f = fixture();
  await f.preferences.refresh();
  const gate = f.hold();
  const favorite = f.preferences.change(f.preferences.snapshot().revision, {
    type: "favorite",
    key: "a",
    enabled: true,
  });
  const a = f.preferences.recordVisit("a"),
    b = f.preferences.recordVisit("b");
  assert.deepEqual(f.writes, [{ type: "favorite", key: "a", enabled: true }]);
  gate.resolve();
  assert.deepEqual(await Promise.all([favorite, a, b]), [true, true, true]);
  assert.deepEqual(f.writes, [
    { type: "favorite", key: "a", enabled: true },
    { type: "visit", key: "a" },
    { type: "visit", key: "b" },
  ]);
  assert.deepEqual(f.preferences.snapshot().state?.recent, ["b", "a"]);
  assert.deepEqual(f.preferences.snapshot().state?.favorites, ["a"]);
  assert.equal(
    await f.preferences.change(f.preferences.snapshot().revision, {
      type: "visit",
      key: "forged-ui",
    }),
    false,
  );
  f.preferences.dispose();
});

test("visits wait for initial local preference acknowledgement", async () => {
  const f = fixture();
  assert.equal(await f.preferences.recordVisit("before-load"), false);
  const gate = f.hold();
  const refresh = f.preferences.refresh();
  const visit = f.preferences.recordVisit("accepted-session");
  assert.deepEqual(f.writes, []);
  gate.resolve();
  assert.deepEqual(await Promise.all([refresh, visit]), [true, true]);
  assert.deepEqual(f.preferences.snapshot().state?.recent, ["accepted-session"]);
  f.preferences.dispose();
});

test("uncertain writes, replaced owners and disposal never replay queued visits", async () => {
  for (const mode of ["failure", "replacement", "dispose"] as const) {
    const f = fixture();
    await f.preferences.refresh();
    const gate = f.hold();
    const first = f.preferences.recordVisit("a");
    const second = f.preferences.recordVisit("b");
    if (mode === "failure") gate.reject(new Error("uncertain response"));
    else {
      if (mode === "replacement") f.replace();
      else f.preferences.dispose();
      gate.resolve();
    }
    assert.deepEqual(await Promise.all([first, second]), [false, false]);
    assert.deepEqual(f.writes, [{ type: "visit", key: "a" }]);
    if (mode !== "dispose") {
      await f.preferences.refresh();
      assert.deepEqual(f.writes, [{ type: "visit", key: "a" }]);
    }
    f.preferences.dispose();
  }
});

test("visit queue is bounded and rejects malformed identities without IO", async () => {
  const f = fixture();
  await f.preferences.refresh();
  for (const key of ["", "bad\nkey", "x".repeat(1025)])
    assert.equal(await f.preferences.recordVisit(key), false);
  assert.deepEqual(f.writes, []);
  const gate = f.hold();
  const first = f.preferences.recordVisit("first");
  const pending = Array.from({ length: 64 }, (_, i) => f.preferences.recordVisit(`session-${i}`));
  assert.equal(await f.preferences.recordVisit("overflow"), false);
  f.preferences.dispose();
  gate.resolve();
  assert.equal(await first, false);
  assert.deepEqual(await Promise.all(pending), Array(64).fill(false));
  assert.deepEqual(f.writes, [{ type: "visit", key: "first" }]);
});
