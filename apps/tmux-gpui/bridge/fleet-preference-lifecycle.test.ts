import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyFleetClientState } from "../../../packages/core/src/fleet-client-state.ts";
import { createFleetPreferenceLifecycle } from "./fleet-preference-lifecycle.ts";
import type { VerifiedLocalFleetPreferenceOwner } from "./fleet-preferences.ts";
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("local verified lifetime refreshes once, replacement once, explicit refresh only thereafter", async () => {
  let calls = 0;
  let selected: VerifiedLocalFleetPreferenceOwner | null = null;
  const make = () => {
    const daemon = {
      protocolVersion: 1,
      productVersion: "fixture",
      instanceId: randomUUID(),
      startedAt: "2026-10-13T00:00:00Z",
    };
    return {
      kind: "local" as const,
      ...daemon,
      assertCurrent() {},
      async request() {
        calls++;
        return Response.json({ daemon, state: emptyFleetClientState() });
      },
    };
  };
  const lifecycle = createFleetPreferenceLifecycle({ getLocalOwner: () => selected });
  lifecycle.observe();
  assert.equal(calls, 0);
  selected = make();
  lifecycle.observe();
  await tick();
  assert.equal(calls, 1);
  for (let i = 0; i < 30; i++) lifecycle.observe();
  await tick();
  assert.equal(calls, 1);
  selected = null;
  lifecycle.observe();
  assert.equal(lifecycle.preferences.snapshot().state, null);
  selected = make();
  lifecycle.observe();
  await tick();
  assert.equal(calls, 2);
  await lifecycle.refresh();
  assert.equal(calls, 3);
  lifecycle.dispose();
  lifecycle.observe();
  assert.equal(calls, 3);
});
test("replacement during an admitted write reads replacement once without replaying write", async () => {
  const calls: string[] = [];
  let release!: () => void;
  const make = (name: string) => {
    const daemon = {
      protocolVersion: 1,
      productVersion: "fixture",
      instanceId: randomUUID(),
      startedAt: "2026-10-13T00:00:00Z",
    };
    return {
      kind: "local" as const,
      ...daemon,
      assertCurrent() {},
      async request(input: { method: "GET" | "POST" }) {
        calls.push(`${name}:${input.method}`);
        if (input.method === "POST") await new Promise<void>((resolve) => (release = resolve));
        return Response.json({ daemon, state: emptyFleetClientState() });
      },
    };
  };
  let selected = make("old");
  const lifecycle = createFleetPreferenceLifecycle({ getLocalOwner: () => selected });
  lifecycle.observe();
  await tick();
  const write = lifecycle.preferences.change(lifecycle.preferences.snapshot().revision, {
    type: "favorite",
    key: "session",
    enabled: true,
  });
  selected = make("new");
  lifecycle.observe();
  release();
  assert.equal(await write, false);
  await tick();
  assert.deepEqual(calls, ["old:GET", "old:POST", "new:GET"]);
  assert.equal(lifecycle.preferences.snapshot().phase, "ready");
  lifecycle.dispose();
});
