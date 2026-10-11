import { test } from "node:test";
import assert from "node:assert/strict";
import { completeFleetServerSelection } from "./fleet-server-selection.ts";

test("server navigation cannot silently finish after background or replacement during either await", async () => {
  for (const stage of ["selection", "catalog"] as const) {
    let resume!: () => void;
    let current = true,
      refreshes = 0,
      retired = 0,
      live = false;
    const gap = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const pending = completeFleetServerSelection({
      select: () => (stage === "selection" ? gap : Promise.resolve()),
      refresh: async (valid) => {
        refreshes++;
        await gap;
        if (valid()) live = true;
      },
      current: () => current,
      retire: () => {
        retired++;
        live = false;
      },
    });
    await Promise.resolve();
    current = false;
    resume();
    await pending;
    assert.equal(live, false);
    assert.equal(retired, 1);
    assert.equal(refreshes, stage === "selection" ? 0 : 1);
  }
});

test("server navigation completes exact selected scope once; failed selection never falls back", async () => {
  let selects = 0,
    refreshes = 0,
    retired = 0;
  const options = {
    select: async () => {
      selects++;
    },
    refresh: async () => {
      refreshes++;
    },
    current: () => true,
    retire: () => {
      retired++;
    },
  };
  await completeFleetServerSelection(options);
  assert.deepEqual([selects, refreshes, retired], [1, 1, 0]);
  await completeFleetServerSelection({
    ...options,
    select: async () => {
      throw new Error("private detail");
    },
  });
  assert.deepEqual([selects, refreshes, retired], [1, 1, 1]);
});
