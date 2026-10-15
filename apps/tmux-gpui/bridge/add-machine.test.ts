import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareMachineConnection } from "./add-machine.ts";
import { createNativeMachineRegistry } from "./machines.ts";
import type { SavedMachineRegistry } from "../../../packages/contracts/src/saved-machines.ts";

function fixture() {
  let registry: SavedMachineRegistry = { version: 1, machines: [] };
  let writes = 0;
  let action = async () => {};
  let fail = false;
  let commit = true;
  let afterSave = () => {};
  const owner = createNativeMachineRegistry(() => {}, {
    read: () => structuredClone(registry),
    watch: () => () => {},
    save: async (profiles) => {
      writes++;
      await action();
      if (commit) registry = { version: 1, machines: [...profiles] };
      afterSave();
      if (fail) throw new Error("private error");
      return registry;
    },
    mutate: async () => registry,
  });
  owner.start();
  return {
    owner,
    writes: () => writes,
    action: (next: () => Promise<void>) => {
      action = next;
    },
    failure: (committed: boolean) => {
      fail = true;
      commit = committed;
    },
    registry: () => registry,
    afterSave: (next: () => void) => {
      afterSave = next;
    },
  };
}

test("Add saves once, then reuses the authoritative saved identity", async () => {
  const f = fixture();
  try {
    const first = await prepareMachineConnection(f.owner, "spark", () => true);
    assert.equal(first?.persisted, true);
    assert.deepEqual(first?.profile, f.registry().machines[0]);
    assert.deepEqual(await prepareMachineConnection(f.owner, "spark", () => true), first);
    assert.equal(f.writes(), 1);
  } finally {
    f.owner.dispose();
  }
});

test("an uncertain save is reconciled without replay; only absent profiles use temporary connection", async () => {
  for (const committed of [false, true]) {
    const f = fixture();
    try {
      f.failure(committed);
      const result = await prepareMachineConnection(f.owner, "spark", () => true);
      assert.equal(result?.persisted, committed);
      assert.equal(result?.profile.sshTarget, "spark");
      assert.equal(f.writes(), 1);
    } finally {
      f.owner.dispose();
    }
  }
});

test("cancelling a pending save prevents connection even when persistence completes", async () => {
  const f = fixture();
  let release!: () => void;
  let current = true;
  f.action(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  try {
    const pending = prepareMachineConnection(f.owner, "spark", () => current);
    assert.equal(f.writes(), 1);
    current = false;
    release();
    assert.equal(await pending, null);
    assert.equal(f.registry().machines.length, 1);
    assert.equal(await prepareMachineConnection(f.owner, "other", () => false), null);
    assert.equal(f.writes(), 1);
  } finally {
    f.owner.dispose();
  }
});

test("a disabled saved profile cannot become a temporary unpinned connection", async () => {
  const f = fixture();
  try {
    await prepareMachineConnection(f.owner, "spark", () => true);
    f.registry().machines[0]!.enabled = false;
    await assert.rejects(
      prepareMachineConnection(f.owner, "spark", () => true),
      { category: "inactive" },
    );
    assert.equal(f.writes(), 1);
  } finally {
    f.owner.dispose();
  }
});

test("a profile changed before save settlement cannot route under stale authority", async () => {
  for (const change of ["disable", "target", "replacement"]) {
    const f = fixture();
    try {
      f.afterSave(() => {
        const saved = f.registry().machines[0]!;
        if (change === "disable") saved.enabled = false;
        else if (change === "target") saved.sshTarget = "changed";
        else saved.id = "00000000-0000-4000-8000-000000000001";
      });
      await assert.rejects(
        prepareMachineConnection(f.owner, "spark", () => true),
        { category: "stale" },
      );
      assert.equal(f.writes(), 1);
    } finally {
      f.owner.dispose();
    }
  }
});
