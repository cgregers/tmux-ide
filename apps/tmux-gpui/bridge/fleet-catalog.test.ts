import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMachineConnectionManager } from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import { createDaemonConnectionOwner } from "../../../packages/daemon/src/lib/daemon-connection-owner.ts";
import { createMachineCatalog } from "../../../packages/daemon/src/lib/machine-catalog.ts";
import type { HomeCatalogSnapshot } from "../../../packages/daemon/src/lib/home-catalog.ts";

test("shared fleet catalog scopes identical session IDs and disables failed-host rows without suppressing healthy hosts", async () => {
  const info = {
    pid: 1,
    port: 4000,
    protocolVersion: 2,
    productVersion: "fixture",
    instanceId: randomUUID(),
    startedAt: "2026-10-11T00:00:00Z",
    bindHostname: "127.0.0.1" as const,
    authToken: "fixture-only",
  };
  const manager = createMachineConnectionManager({
    createOwner: () =>
      createDaemonConnectionOwner({
        readLocal: () => info,
        isLocalAlive: async () => true,
        observeLocal: async () => () => {},
        connect: async () => {
          let close!: () => void;
          return {
            daemon: info,
            baseUrl: "http://127.0.0.1:4000",
            closed: new Promise<void>((resolve) => {
              close = resolve;
            }),
            dispose: () => close(),
          };
        },
      }),
  });
  const profile = { id: randomUUID(), label: "Build", sshTarget: "build", enabled: true };
  const remote = manager.add(profile);
  await remote.ready;
  const emitters = new Map<string, (value: HomeCatalogSnapshot) => void>();
  const disposed: string[] = [];
  const catalog = createMachineCatalog({
    manager,
    createCatalog: (handle) => {
      let value: HomeCatalogSnapshot = {
        phase: "live",
        daemonInstanceId: info.instanceId,
        sessions: [{ id: "same-session", name: "Workspace", paneCount: 2 }],
        note: null,
      };
      const listeners = new Set<(value: HomeCatalogSnapshot) => void>();
      emitters.set(handle.id, (next) => {
        value = next;
        for (const listener of listeners) listener(value);
      });
      return {
        getSnapshot: () => value,
        start() {},
        retry() {},
        subscribe(listener) {
          listeners.add(listener);
          listener(value);
          return () => {
            listeners.delete(listener);
          };
        },
        dispose() {
          disposed.push(handle.id);
          listeners.clear();
        },
      };
    },
  });
  try {
    catalog.start();
    const groups = catalog.getSnapshot().groups;
    assert.equal(groups.length, 2);
    assert.notEqual(groups[0]!.sessions[0]!.id, groups[1]!.sessions[0]!.id);
    assert.ok(groups.every((group) => group.state === "ready"));
    manager.select(remote.id);
    emitters.get(remote.id)!({
      phase: "unavailable",
      daemonInstanceId: null,
      sessions: [],
      note: "Fixture disconnected",
    });
    const failed = catalog.getSnapshot().groups.find((group) => group.id === remote.id)!;
    assert.equal(failed.state, "disconnected");
    assert.equal(failed.sessions.length, 1);
    assert.equal(failed.sessions[0]!.disabled, true);
    assert.deepEqual(catalog.getSelectedCatalogSnapshot().sessions, []);
    assert.equal(
      catalog.getSnapshot().groups.find((group) => group.id === "local")!.state,
      "ready",
    );
  } finally {
    catalog.dispose();
    manager.dispose();
  }
  assert.deepEqual(disposed.sort(), ["local", remote.id].sort());
});
