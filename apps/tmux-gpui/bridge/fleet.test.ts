import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createMachineConnectionManager } from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import { createDaemonConnectionOwner } from "../../../packages/daemon/src/lib/daemon-connection-owner.ts";
import { createMachineCatalog } from "../../../packages/daemon/src/lib/machine-catalog.ts";
import type { HomeCatalogSnapshot } from "../../../packages/daemon/src/lib/home-catalog.ts";
import { createNativeFleet } from "./fleet.ts";

async function fixture(count = 1) {
  const info = {
    pid: 1,
    port: 4000,
    protocolVersion: 2,
    productVersion: "fixture",
    instanceId: randomUUID(),
    startedAt: "2026-10-11T00:00:00Z",
    bindHostname: "127.0.0.1" as const,
    authToken: "secret-must-never-cross-wire",
  };
  const manager = createMachineConnectionManager({
    createOwner: () =>
      createDaemonConnectionOwner({
        readLocal: () => info,
        isLocalAlive: async () => true,
        observeLocal: async () => () => {},
        connect: async () => ({
          daemon: info,
          baseUrl: "http://127.0.0.1:4000",
          closed: new Promise<void>(() => {}),
          dispose() {},
        }),
      }),
  });
  const profiles = Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    label: `Build ${i}`,
    sshTarget: `build-${i}`,
    enabled: true,
  }));
  manager.initialize(profiles);
  await Promise.all(profiles.map((p) => manager.getMachine(p.id)!.ready));
  const emitters = new Map<string, (next: HomeCatalogSnapshot) => void>();
  const snapshot: HomeCatalogSnapshot = {
    phase: "live",
    daemonInstanceId: info.instanceId,
    note: null,
    sessions: [
      {
        id: "same",
        liveSessionId: "$1",
        workspaceName: "workspace",
        name: "Workspace",
        paneCount: 2,
        server: {
          serverId: `tmux-server.${randomUUID().replaceAll("-", "")}`,
          generation: randomUUID(),
        },
      },
    ],
  };
  let notifications = 0;
  const fleet = createNativeFleet(
    manager,
    () => {
      notifications++;
    },
    (manager) =>
      createMachineCatalog({
        manager,
        createCatalog: (handle) => {
          let current = structuredClone(snapshot);
          const listeners = new Set<(value: HomeCatalogSnapshot) => void>();
          emitters.set(handle.id, (next) => {
            current = next;
            for (const listener of listeners) listener(next);
          });
          return {
            getSnapshot: () => current,
            start() {},
            retry() {},
            subscribe(listener) {
              listeners.add(listener);
              listener(current);
              return () => {
                listeners.delete(listener);
              };
            },
            dispose() {
              listeners.clear();
            },
          };
        },
      }),
  );
  fleet.start();
  return {
    fleet,
    manager,
    profiles,
    snapshot,
    emitters,
    notifications: () => notifications,
    close() {
      fleet.dispose();
      manager.dispose();
    },
  };
}

test("native fleet projects credential-free groups and selects exact routes with duplicate session names", async () => {
  const f = await fixture();
  try {
    const groups = f.fleet.publication().groups;
    assert.equal(groups.length, 2);
    assert.notEqual(groups[0]!.sessions[0]!.selection, groups[1]!.sessions[0]!.selection);
    assert.equal(JSON.stringify(groups).includes("secret-must-never-cross-wire"), false);
    assert.equal(JSON.stringify(groups).includes("127.0.0.1"), false);
    const remote = f.fleet.select(groups[1]!.sessions[0]!.selection!);
    assert.equal(remote.handle.id, f.profiles[0]!.id);
    remote.assertCurrent();
    f.fleet.select(groups[0]!.sessions[0]!.selection!);
    assert.throws(remote.assertCurrent, /changed/);
    f.fleet.select(groups[1]!.sessions[0]!.selection!);
    assert.throws(remote.assertCurrent, /changed/);
    // Publications are detached; view mutation cannot change selection authority.
    groups[0]!.sessions[0]!.selection = "forged";
    assert.throws(() => f.fleet.select("forged"), /changed/);
  } finally {
    f.close();
  }
});

test("unavailable catalog revokes a displayed token and reconnect never replays it", async () => {
  const f = await fixture();
  try {
    const id = f.profiles[0]!.id;
    const token = f.fleet.publication().groups.find((g) => g.id === id)!.sessions[0]!.selection!;
    const selection = f.fleet.select(token);
    f.emitters.get(id)!({
      phase: "unavailable",
      daemonInstanceId: null,
      sessions: [],
      note: "private diagnostic",
    });
    const failed = f.fleet.publication().groups.find((g) => g.id === id)!;
    assert.equal(failed.sessions[0]!.selection, null);
    assert.throws(selection.assertCurrent, /changed/);
    assert.throws(() => f.fleet.select(token), /changed/);
    f.emitters.get(id)!(f.snapshot);
    assert.notEqual(
      f.fleet.publication().groups.find((g) => g.id === id)!.sessions[0]!.selection,
      token,
    );
    assert.throws(() => f.fleet.select(token), /changed/);
    assert.ok(f.fleet.publication().groups.find((g) => g.id === "local")!.sessions[0]!.selection);
  } finally {
    f.close();
  }
});

test("ordinary tmux sessions remain selectable before daemon workspace promotion", async () => {
  const f = await fixture();
  try {
    const session = { ...f.snapshot.sessions[0]! };
    delete session.workspaceName;
    f.emitters.get("local")!({ ...f.snapshot, sessions: [session] });
    const token = f.fleet.publication().groups.find((g) => g.id === "local")!.sessions[0]!
      .selection;
    assert.ok(token);
    const selected = f.fleet.select(token);
    assert.equal(selected.session.workspaceName, undefined);
    assert.equal(selected.session.liveSessionId, session.liveSessionId);
    selected.assertCurrent();
    f.emitters.get("local")!({
      ...f.snapshot,
      sessions: [{ ...session, workspaceName: "promoted" }],
    });
    selected.assertCurrent();
    assert.equal(
      f.fleet.publication().groups.find((g) => g.id === "local")!.sessions[0]!.selection,
      token,
    );
    f.emitters.get("local")!({
      ...f.snapshot,
      sessions: [{ ...session, server: { ...session.server!, generation: randomUUID() } }],
    });
    assert.throws(selected.assertCurrent, /changed/);
    assert.throws(() => f.fleet.select(token), /changed/);
  } finally {
    f.close();
  }
});

test("profile replacement retires borrowed selections; label edits preserve them", async () => {
  const f = await fixture();
  try {
    const profile = f.profiles[0]!;
    const token = f.fleet.publication().groups.find((g) => g.id === profile.id)!.sessions[0]!
      .selection!;
    const selection = f.fleet.select(token);
    f.manager.reconcile([{ ...profile, label: "Renamed" }]);
    selection.assertCurrent();
    assert.equal(f.fleet.publication().groups.find((g) => g.id === profile.id)!.label, "Renamed");
    f.manager.reconcile([{ ...profile, sshTarget: "replacement" }]);
    assert.throws(selection.assertCurrent, /changed/);
    assert.throws(() => f.fleet.select(token), /changed/);
    await f.manager.getMachine(profile.id)!.ready;
    assert.throws(() => f.fleet.select(token), /changed/);
  } finally {
    f.close();
  }
});

test("fleet publication is globally bounded and disposal leaves borrowed connections alive", async () => {
  const f = await fixture(5);
  try {
    const large = {
      ...f.snapshot,
      sessions: Array.from({ length: 300 }, (_, i) => ({
        ...f.snapshot.sessions[0]!,
        id: String(i),
        liveSessionId: `$${i}`,
      })),
    };
    for (const emit of f.emitters.values()) emit(large);
    const publication = f.fleet.publication();
    assert.equal(
      publication.groups.reduce((n, g) => n + g.sessions.length, 0),
      512,
    );
    assert.equal(
      publication.groups.reduce((n, g) => n + g.omittedSessions, 0),
      1800 - 512,
    );
    const token = publication.groups[0]!.sessions[0]!.selection!;
    const before = f.notifications();
    f.fleet.dispose();
    for (const emit of f.emitters.values()) emit(f.snapshot);
    assert.equal(f.notifications(), before);
    assert.throws(() => f.fleet.select(token), /changed/);
    assert.equal(f.manager.getMachine(f.profiles[0]!.id)!.endpoint().state, "ready");
  } finally {
    f.close();
  }
});

test("retry uses the captured disconnected handle, leaves siblings and selection alone, and consumes its token", async () => {
  const f = await fixture(2);
  try {
    const id = f.profiles[0]!.id;
    const sibling = f.manager.getMachine(f.profiles[1]!.id)!;
    const siblingEpoch = sibling.endpoint().epoch;
    const selected = f.manager.snapshot().selectedMachineId;
    f.manager.disconnect(id);
    const token = f.fleet.publication().groups.find((g) => g.id === id)!.retry;
    assert.ok(token);
    assert.equal(f.fleet.publication().groups.find((g) => g.id === "local")!.retry, null);
    let unsubscribe = () => {};
    const recovered = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error("Retry did not recover"));
      }, 2000);
      unsubscribe = f.manager.subscribe(() => {
        if (f.manager.getMachine(id)!.endpoint().state !== "ready") return;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      });
    });
    f.fleet.retry(token);
    assert.throws(() => f.fleet.retry(token), /changed/);
    await recovered;
    assert.equal(f.manager.getMachine(f.profiles[1]!.id), sibling);
    assert.equal(sibling.endpoint().epoch, siblingEpoch);
    assert.equal(f.manager.snapshot().selectedMachineId, selected);
    assert.equal(f.manager.getMachine(id)!.endpoint().state, "ready");
  } finally {
    f.close();
  }
});

test("retry token cannot reconnect a removed or replaced saved machine", async () => {
  const f = await fixture();
  try {
    const profile = f.profiles[0]!;
    f.manager.disconnect(profile.id);
    const token = f.fleet.publication().groups.find((g) => g.id === profile.id)!.retry!;
    assert.ok(token);
    f.manager.reconcile([{ ...profile, sshTarget: "replacement" }]);
    assert.throws(() => f.fleet.retry(token), /changed/);
    await f.manager.getMachine(profile.id)!.ready;
    f.manager.disconnect(profile.id);
    const replacement = f.fleet.publication().groups.find((g) => g.id === profile.id)!.retry!;
    assert.ok(replacement);
    assert.notEqual(replacement, token);
    f.manager.reconcile([]);
    assert.throws(() => f.fleet.retry(replacement), /changed/);
    f.fleet.dispose();
    assert.throws(() => f.fleet.retry(replacement), /changed/);
  } finally {
    f.close();
  }
});

test("disconnect retires selected input authority, preserves profiles and siblings, and allows explicit retry", async () => {
  const f = await fixture(2);
  try {
    const profile = f.profiles[0]!;
    const group = () => f.fleet.publication().groups.find((g) => g.id === profile.id)!;
    const selected = f.fleet.select(group().sessions[0]!.selection!);
    const sibling = f.manager.getMachine(f.profiles[1]!.id)!;
    const epoch = sibling.endpoint().epoch;
    const profiles = f.manager
      .snapshot()
      .machines.map(({ id, label, kind, sshTarget }) => ({ id, label, kind, sshTarget }));
    const token = group().disconnect!;
    assert.ok(token);
    assert.equal(f.fleet.publication().groups.find((g) => g.id === "local")!.disconnect, null);
    f.fleet.disconnect(token);
    assert.throws(selected.assertCurrent, /changed/);
    assert.throws(() => f.fleet.disconnect(token), /changed/);
    assert.equal(group().disconnect, null);
    assert.ok(group().retry);
    assert.equal(f.manager.getMachine(profile.id)!.endpoint().state, "disconnected");
    assert.equal(f.manager.getMachine(sibling.id), sibling);
    assert.equal(sibling.endpoint().epoch, epoch);
    assert.deepEqual(
      f.manager
        .snapshot()
        .machines.map(({ id, label, kind, sshTarget }) => ({ id, label, kind, sshTarget })),
      profiles,
    );
    // Reconciliation with unchanged saved settings must not undo deliberate disconnect.
    f.manager.reconcile(f.profiles);
    assert.equal(f.manager.getMachine(profile.id)!.endpoint().state, "disconnected");
  } finally {
    f.close();
  }
});

test("disconnect tokens survive display edits but reject replaced, removed and disposed routes", async () => {
  const f = await fixture();
  try {
    const profile = f.profiles[0]!;
    const token = f.fleet.publication().groups.find((g) => g.id === profile.id)!.disconnect!;
    f.manager.reconcile([{ ...profile, label: "Renamed" }]);
    assert.equal(f.fleet.publication().groups.find((g) => g.id === profile.id)!.disconnect, token);
    f.manager.reconcile([{ ...profile, sshTarget: "replacement" }]);
    assert.throws(() => f.fleet.disconnect(token), /changed/);
    await f.manager.getMachine(profile.id)!.ready;
    const replacement = f.fleet.publication().groups.find((g) => g.id === profile.id)!.disconnect!;
    assert.ok(replacement);
    assert.notEqual(replacement, token);
    f.manager.reconcile([]);
    assert.throws(() => f.fleet.disconnect(replacement), /changed/);
    f.fleet.dispose();
    assert.throws(() => f.fleet.disconnect(replacement), /changed/);
  } finally {
    f.close();
  }
});

test("catalog failure does not hide disconnect for a still-connected SSH transport", async () => {
  const f = await fixture();
  try {
    const id = f.profiles[0]!.id;
    f.emitters.get(id)!({
      phase: "unavailable",
      daemonInstanceId: null,
      sessions: [],
      note: "fixture",
    });
    const group = f.fleet.publication().groups.find((g) => g.id === id)!;
    assert.equal(group.state, "disconnected");
    assert.ok(group.disconnect);
    f.fleet.disconnect(group.disconnect);
    assert.equal(f.manager.getMachine(id)!.endpoint().state, "disconnected");
  } finally {
    f.close();
  }
});
