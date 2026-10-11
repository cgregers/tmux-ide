import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createNativeMachineRegistry,
  MachineRegistryError,
  savedMachineRouteMatches,
} from "./machines.ts";
import type { SavedMachineRegistry } from "../../../packages/contracts/src/saved-machines.ts";

function fixture() {
  let registry: SavedMachineRegistry = {
    version: 1,
    machines: [
      {
        id: randomUUID(),
        label: "Build",
        sshTarget: "build",
        enabled: true,
        expectedEnvironmentId: randomUUID(),
      },
    ],
  };
  let corrupt = false,
    notifications = 0,
    closed = 0,
    writes = 0;
  let watched = () => {};
  let action = async () => {};
  const owner = createNativeMachineRegistry(() => notifications++, {
    read: () => {
      if (corrupt) throw new Error("private registry data");
      return structuredClone(registry);
    },
    watch: (change) => {
      watched = () => change(registry);
      return () => {
        closed++;
      };
    },
    save: async (machines) => {
      writes++;
      await action();
      registry = { version: 1, machines: [...machines] };
      return registry;
    },
    mutate: async () => {
      writes++;
      await action();
      registry = { version: 1, machines: [] };
      return registry;
    },
  });
  owner.start();
  return {
    owner,
    get registry() {
      return registry;
    },
    set registry(value) {
      registry = value;
    },
    corrupt() {
      corrupt = true;
      watched();
    },
    recover() {
      corrupt = false;
      watched();
    },
    watched: () => watched(),
    action: (next: () => Promise<void>) => {
      action = next;
    },
    counts: () => ({ notifications, closed, writes }),
  };
}

test("saved selection preserves UUID and expected environment identity, never a display-label route", () => {
  const f = fixture();
  try {
    const p = f.owner.publication();
    const selected = f.owner.select(p.machines[0]!.id, p.revision);
    assert.deepEqual(selected, f.registry.machines[0]);
    selected.sshTarget = "mutated";
    p.machines[0]!.label = "changed";
    assert.equal(f.owner.publication().machines[0]!.sshTarget, "build");
    assert.equal(f.owner.publication().machines[0]!.label, "Build");
    assert.throws(() => f.owner.select("Build", p.revision), { category: "inactive" });
  } finally {
    f.owner.dispose();
  }
});

test("selection and writes re-read before watcher notification, rejecting stale and disabled profiles", async () => {
  const f = fixture();
  try {
    const p = f.owner.publication();
    f.registry.machines[0]!.enabled = false;
    assert.throws(() => f.owner.select(p.machines[0]!.id, p.revision), { category: "stale" });
    assert.throws(() => f.owner.select(p.machines[0]!.id, f.owner.publication().revision), {
      category: "inactive",
    });
    await assert.rejects(f.owner.save(p.machines[0]!, p.revision), { category: "stale" });
    assert.equal(f.counts().writes, 0);
  } finally {
    f.owner.dispose();
  }
});

test("corruption retains last valid display but revokes selection and writes without leaking diagnostics", async () => {
  const f = fixture();
  try {
    const before = f.owner.publication();
    f.corrupt();
    const p = f.owner.publication();
    assert.equal(p.available, false);
    assert.deepEqual(p.machines, before.machines);
    assert.equal(JSON.stringify(p).includes("private registry data"), false);
    assert.throws(() => f.owner.select(before.machines[0]!.id, p.revision), {
      category: "unavailable",
    });
    await assert.rejects(f.owner.save(before.machines[0]!, p.revision), {
      category: "unavailable",
    });
    f.recover();
    assert.equal(f.owner.publication().available, true);
  } finally {
    f.owner.dispose();
  }
});

test("only one mutation runs, and dispose suppresses late publication without replaying writes", async () => {
  const f = fixture();
  let release!: () => void;
  f.action(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const p = f.owner.publication();
  const pending = f.owner.save(p.machines[0]!, p.revision);
  assert.equal(f.owner.publication().pending, true);
  await assert.rejects(f.owner.mutate({ id: p.machines[0]!.id, operation: "remove" }, p.revision), {
    category: "busy",
  });
  f.owner.dispose();
  const before = f.counts().notifications;
  release();
  await pending;
  f.watched();
  assert.equal(f.counts().notifications, before);
  assert.equal(f.counts().writes, 1);
  assert.equal(f.counts().closed, 1);
});

test("uncertain write response refreshes local state and exposes a fixed error, never automatic retry", async () => {
  const f = fixture();
  try {
    const p = f.owner.publication();
    f.action(async () => {
      f.registry = { version: 1, machines: [] };
      throw new Error("secret token");
    });
    await assert.rejects(
      f.owner.mutate({ id: p.machines[0]!.id, operation: "remove" }, p.revision),
      (error) => error instanceof MachineRegistryError && error.category === "write",
    );
    assert.deepEqual(f.owner.publication().machines, []);
    assert.equal(f.owner.publication().pending, false);
    assert.equal(f.counts().writes, 1);
    assert.equal(JSON.stringify(f.owner.publication()).includes("secret token"), false);
    f.owner.refresh();
    assert.equal(f.owner.publication().error, null);
  } finally {
    f.owner.dispose();
  }
});

test("saved route reconciliation preserves display edits and rejects authority changes", () => {
  const f = fixture();
  try {
    const selected = f.registry.machines[0]!;
    const publication = f.owner.publication();
    const changed = (patch: Partial<typeof selected>) => ({
      ...publication,
      machines: [{ ...selected, ...patch }],
    });
    assert.equal(savedMachineRouteMatches(selected, changed({ label: "Renamed" })), true);
    for (const patch of [
      { enabled: false },
      { sshTarget: "elsewhere" },
      { expectedEnvironmentId: randomUUID() },
    ])
      assert.equal(savedMachineRouteMatches(selected, changed(patch)), false);
    assert.equal(savedMachineRouteMatches(selected, { ...publication, machines: [] }), false);
    assert.equal(savedMachineRouteMatches(selected, { ...publication, available: false }), false);
  } finally {
    f.owner.dispose();
  }
});
