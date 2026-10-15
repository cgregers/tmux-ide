import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createSessionHistoryController,
  sessionHistoryCommandSchema,
} from "./session-history-controller.ts";
const all = () => true;
function fixture() {
  const owner = createSessionHistoryController();
  owner.seed(["C", "B", "A"]);
  const command = (
    request: number,
    fromRequest: number,
    direction: "back" | "forward" = "back",
  ) => {
    const p = owner.publication(fromRequest, true)!;
    return {
      type: "session-history" as const,
      request,
      fromRequest,
      revision: p.revision,
      action: p[direction]!,
    };
  };
  return { owner, command };
}
test("history capability admission leaves cursor unchanged until exact live acceptance", () => {
  const { owner, command } = fixture();
  assert.equal(owner.admit(command(1, 0), 0, true, all), "B");
  owner.navigation(1);
  assert.deepEqual(owner.publication(1, true), { revision: 2, back: null, forward: null });
  assert.equal(owner.accept(0, "B"), null);
  assert.deepEqual(owner.accept(1, "B"), { type: "visit", key: "B" });
  assert.equal(owner.accept(1, "B"), null);
  assert.equal(owner.admit(command(2, 1, "forward"), 1, true, all), "C");
});
test("catalog-only traversal continues through exact canonical Pane request and commits only live", () => {
  const { owner, command } = fixture();
  owner.admit(command(1, 0), 0, true, all);
  owner.navigation(1);
  const catalog = {};
  assert.equal(owner.catalogReady(1, "B", catalog, 1), true);
  owner.navigation(2, { fromRequest: 1, key: "B", catalog, presence: 1 });
  assert.equal(owner.accept(1, "B"), null);
  assert.deepEqual(owner.accept(2, "B"), { type: "visit", key: "B" });
  assert.equal(owner.admit(command(3, 2, "forward"), 2, true, all), "C");
});
test("wrong canonical continuation and unrelated navigation cannot commit old traversal", () => {
  for (const continuation of [
    { fromRequest: 0, key: "B" },
    { fromRequest: 1, key: "replaced-generation" },
  ]) {
    const { owner, command } = fixture();
    owner.admit(command(1, 0), 0, true, all);
    owner.navigation(1);
    const catalog = {};
    owner.catalogReady(1, "B", catalog, 1);
    owner.navigation(2, { ...continuation, catalog, presence: 1 });
    assert.equal(owner.accept(1, "B"), null);
    assert.deepEqual(owner.accept(2, "D"), { type: "visit", key: "D" });
    assert.equal(owner.admit(command(3, 2), 2, true, all), "C");
  }
});
test("background cancellation and supersession refuse late accepted completion", () => {
  const { owner, command } = fixture();
  owner.admit(command(1, 0), 0, true, all);
  owner.navigation(1);
  owner.cancel();
  assert.equal(owner.accept(1, "B"), null);
  assert.equal(owner.admit(command(2, 1), 1, true, all), "B");
  owner.navigation(3);
  assert.equal(owner.accept(2, "B"), null);
  assert.deepEqual(owner.accept(3, "D"), { type: "visit", key: "D" });
});
test("unavailable exact identity does not skip entries; rejected attempt does not consume fresh capability", () => {
  const { owner, command } = fixture();
  const old = command(1, 0);
  assert.equal(
    owner.admit(old, 0, true, (key) => key !== "B"),
    null,
  );
  assert.ok(owner.publication(0, true)!.back);
  assert.equal(owner.admit(command(2, 0), 0, true, all), "B");
});
test("stale revision, frame request, foreground and unknown action reject without cursor mutation", () => {
  for (const change of [{ revision: 99 }, { fromRequest: 99 }, { action: randomUUID() }]) {
    const { owner, command } = fixture();
    assert.equal(owner.admit({ ...command(1, 0), ...change }, 0, true, all), null);
    assert.equal(owner.admit(command(2, 0), 0, true, all), "B");
  }
  const { owner, command } = fixture();
  assert.equal(owner.admit(command(1, 0), 0, false, all), null);
  assert.equal(owner.admit(command(1, 0), 0, true, all), null);
  assert.equal(owner.admit(command(2, 0), 0, true, all), "B");
});
test("seed once and availability hide capabilities without inventing a local history store", () => {
  const owner = createSessionHistoryController();
  assert.equal(owner.publication(0, true), null);
  owner.seed(["B", "A"]);
  owner.seed(["wrong"]);
  assert.equal(owner.publication(0, false), null);
  const p = owner.publication(0, true)!;
  assert.equal(
    owner.admit(
      {
        type: "session-history",
        request: 1,
        fromRequest: 0,
        revision: p.revision,
        action: p.back!,
      },
      0,
      true,
      all,
    ),
    "A",
  );
});
test("history command is strict and rejects raw target substitution and unsafe numbers", () => {
  const base = {
    type: "session-history",
    request: 1,
    fromRequest: 0,
    revision: 1,
    action: randomUUID(),
  };
  assert.equal(sessionHistoryCommandSchema.safeParse(base).success, true);
  for (const bad of [
    { ...base, key: "A" },
    { ...base, revision: 0 },
    { ...base, request: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.equal(sessionHistoryCommandSchema.safeParse(bad).success, false);
});

test("cancelled or mismatched continued traversal cannot become an ordinary visit on a later frame", () => {
  for (const mode of ["cancel", "mismatch"]) {
    const { owner, command } = fixture();
    owner.admit(command(1, 0), 0, true, all);
    owner.navigation(1);
    const catalog = {};
    assert.equal(owner.catalogReady(1, "B", catalog, 1), true);
    owner.navigation(2, { fromRequest: 1, key: "B", catalog, presence: 1 });
    if (mode === "cancel") owner.cancel();
    else assert.equal(owner.accept(2, "wrong"), null);
    assert.equal(owner.accept(2, "B"), null);
    assert.equal(owner.admit(command(3, 2), 2, true, all), "B");
  }
});

test("completed metadata proof survives helper retirement but not catalog or presence replacement", () => {
  for (const mismatch of ["catalog", "presence", "missing"]) {
    const { owner, command } = fixture(),
      catalog = {};
    owner.admit(command(1, 0), 0, true, all);
    owner.navigation(1);
    if (mismatch !== "missing") assert.equal(owner.catalogReady(1, "B", catalog, 1), true);
    owner.navigation(2, {
      fromRequest: 1,
      key: "B",
      catalog: mismatch === "catalog" ? {} : catalog,
      presence: mismatch === "presence" ? 2 : 1,
    });
    assert.deepEqual(owner.accept(2, "D"), { type: "visit", key: "D" });
    assert.equal(owner.admit(command(3, 2), 2, true, all), "C");
  }
});
test("background invalidates catalog proof and a late metadata completion cannot revive it", () => {
  const { owner, command } = fixture(),
    catalog = {};
  owner.admit(command(1, 0), 0, true, all);
  owner.navigation(1);
  owner.catalogReady(1, "B", catalog, 1);
  owner.cancel();
  assert.equal(owner.catalogReady(1, "B", catalog, 1), false);
  owner.navigation(2, { fromRequest: 1, key: "B", catalog, presence: 1 });
  assert.equal(owner.accept(1, "B"), null);
  assert.deepEqual(owner.accept(2, "D"), { type: "visit", key: "D" });
  assert.equal(owner.admit(command(3, 2), 2, true, all), "C");
});
