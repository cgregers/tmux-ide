import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHomeAgentFilter } from "./home-agent-filter.ts";

test("Home machine filtering is same-request/revision and foreground only", () => {
  const current = { request: 3, revision: 7, foreground: true, home: true };
  const command = { type: "home-agent-filter", request: 3, rosterRevision: 7, machineId: "remote" };
  const selected: (string | null)[] = [];
  const apply = (id: string | null) => {
    if (id !== null && id !== "remote") return false;
    selected.push(id);
    return true;
  };
  for (const state of [
    { ...current, request: 4 },
    { ...current, revision: 8 },
    { ...current, foreground: false },
    { ...current, home: false },
  ])
    assert.equal(applyHomeAgentFilter(command, state, apply), false);
  assert.equal(applyHomeAgentFilter({ ...command, machineId: "removed" }, current, apply), false);
  assert.equal(
    applyHomeAgentFilter({ ...command, machineId: "x".repeat(513) }, current, apply),
    false,
  );
  assert.deepEqual(selected, []);
  assert.equal(applyHomeAgentFilter(command, current, apply), true);
  assert.equal(applyHomeAgentFilter({ ...command, machineId: null }, current, apply), true);
  assert.deepEqual(selected, ["remote", null]);
  assert.equal(current.request, 3);
});
