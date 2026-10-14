import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDaemonConnectionOwner } from "../../../packages/daemon/src/lib/daemon-connection-owner.ts";
import { createFleetConnectionOwner } from "./fleet-local-owner.ts";

test("local fleet retries one failed identity probe with the same record without concurrent or post-disposal publication", async () => {
  const info = {
    pid: process.pid,
    port: 4000,
    protocolVersion: 2,
    productVersion: "fixture",
    instanceId: randomUUID(),
    startedAt: "2026-10-11T00:00:00Z",
    bindHostname: "127.0.0.1" as const,
    authToken: "test-only",
  };
  let now = 0,
    calls = 0,
    notifications = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const owner = createFleetConnectionOwner({
    createOwner: () =>
      createDaemonConnectionOwner({
        readLocal: () => info,
        isLocalAlive: async () => true,
        observeLocal: async () => () => {},
        connect: async () => {
          throw Error("No SSH expected");
        },
      }),
    now: () => now,
    discover: async () => {
      if (++calls === 1) throw Error("Transient timeout");
      await gate;
      return info;
    },
  });
  const stop = await owner.observe(() => {
    notifications++;
  });
  assert.equal(owner.read(), null);
  assert.equal(calls, 1);
  now = 1001;
  for (let i = 0; i < 20; i++) assert.equal(owner.read(), null);
  assert.equal(calls, 2);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(owner.read(), info);
  assert.equal(calls, 2);
  const before = notifications;
  stop();
  owner.dispose();
  assert.equal(owner.read(), null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(notifications, before);
});
