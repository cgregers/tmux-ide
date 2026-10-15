import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMachineConnectionManager } from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import { createDaemonConnectionOwner } from "../../../packages/daemon/src/lib/daemon-connection-owner.ts";

// Native consumers import the shared owner directly, without creating the TUI singleton.
test("shared fleet manager keeps other hosts live when one saved route is disabled", async () => {
  const daemon = {
    pid: 123,
    port: 7000,
    protocolVersion: 2,
    productVersion: "fixture",
    instanceId: randomUUID(),
    startedAt: "2026-10-11T00:00:00.000Z",
    bindHostname: "127.0.0.1" as const,
    authToken: "fixture-only",
  };
  const closed = new Map<string, number>();
  const manager = createMachineConnectionManager({
    createOwner: () =>
      createDaemonConnectionOwner({
        readLocal: () => daemon,
        isLocalAlive: async () => true,
        observeLocal: async () => () => {},
        connect: async ({ alias }) => {
          let resolve!: () => void;
          return {
            daemon,
            baseUrl: "http://127.0.0.1:7000",
            closed: new Promise<void>((done) => {
              resolve = done;
            }),
            dispose: () => {
              closed.set(alias, (closed.get(alias) ?? 0) + 1);
              resolve();
            },
          };
        },
      }),
  });
  const profiles = ["build", "dev"].map((sshTarget) => ({
    id: randomUUID(),
    label: sshTarget,
    sshTarget,
    enabled: true,
  }));
  try {
    manager.initialize(profiles);
    const first = manager.getMachine(profiles[0]!.id)!;
    const second = manager.getMachine(profiles[1]!.id)!;
    assert.deepEqual(await Promise.all([first.ready, second.ready]), [true, true]);
    manager.select(first.id);
    manager.select(second.id);
    assert.equal(closed.size, 0);
    manager.reconcile([{ ...profiles[0]!, enabled: false }, profiles[1]!]);
    assert.equal(first.read(), null);
    assert.equal(closed.get("build"), 1);
    assert.equal(closed.get("dev"), undefined);
    assert.equal(manager.getMachine(second.id), second);
    assert.equal(manager.snapshot().selectedMachineId, second.id);
  } finally {
    manager.dispose();
  }
  assert.equal(closed.get("dev"), 1);
});
