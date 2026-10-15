import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionNavigationHistory } from "./session-navigation-history.ts";

test("canonical recents seed chronological detached keys, with newest duplicate retained", () => {
  const saved = ["C", "B", "A", "B"];
  const owner = createSessionNavigationHistory(saved);
  saved[0] = "changed";
  assert.deepEqual(owner.snapshot(), { entries: ["A", "B", "C"], index: 2, pending: null });
  owner.snapshot().entries.pop();
  assert.equal(owner.snapshot().entries.length, 3);
  assert.throws(() => createSessionNavigationHistory(["invalid\0key"]));
});

test("A-B-C-back-D truncates only the accepted forward branch", () => {
  const owner = createSessionNavigationHistory();
  for (const [i, key] of ["A", "B", "C"].entries()) {
    const ticket = owner.beginVisit(i + 1, key)!;
    assert.deepEqual(owner.complete(ticket, { accepted: true, key }), { type: "visit", key });
  }
  const back = owner.beginTraversal(4, -1, (key) => key === "B")!;
  assert.equal(owner.snapshot().index, 2);
  owner.complete(back, { accepted: true, key: "B" });
  const rejected = owner.beginVisit(5, "D")!;
  owner.complete(rejected, { accepted: false });
  assert.deepEqual(owner.snapshot().entries, ["A", "B", "C"]);
  const next = owner.beginVisit(6, "D")!;
  owner.complete(next, { accepted: true, key: "D" });
  assert.deepEqual(owner.snapshot(), { entries: ["A", "B", "D"], index: 2, pending: null });
  assert.equal(
    owner.beginTraversal(7, 1, () => true),
    null,
  );
});

test("adjacent duplicates do not erase forward history; nonadjacent revisits retain back path", () => {
  const owner = createSessionNavigationHistory(["C", "B", "A"]);
  owner.complete(owner.beginTraversal(1, -1, () => true)!, { accepted: true, key: "B" });
  owner.complete(owner.beginVisit(2, "B")!, { accepted: true, key: "B" });
  assert.deepEqual(owner.snapshot().entries, ["A", "B", "C"]);
  owner.complete(owner.beginVisit(3, "A")!, { accepted: true, key: "A" });
  assert.deepEqual(owner.snapshot().entries, ["A", "B", "A"]);
  assert.equal(owner.beginTraversal(4, -1, () => true)?.key, "B");
});

test("64-entry bound drops oldest, and duplicate frame completions emit no second visit", () => {
  const owner = createSessionNavigationHistory();
  for (let attempt = 1; attempt <= 65; attempt++) {
    const ticket = owner.beginVisit(attempt, `key-${attempt}`)!;
    assert.ok(owner.complete(ticket, { accepted: true, key: ticket.key }));
    assert.equal(owner.complete(ticket, { accepted: true, key: ticket.key }), null);
  }
  assert.equal(owner.snapshot().entries.length, 64);
  assert.equal(owner.snapshot().entries[0], "key-2");
  assert.equal(owner.snapshot().index, 63);
});

test("fresh unavailable identity never falls back or moves cursor, and supersedes old completion", () => {
  const owner = createSessionNavigationHistory(["server-B/session", "server-A/session"]);
  const old = owner.beginTraversal(1, -1, () => true)!;
  const checked: string[] = [];
  assert.equal(
    owner.beginTraversal(2, -1, (key) => {
      checked.push(key);
      return false;
    }),
    null,
  );
  assert.deepEqual(checked, ["server-A/session"]);
  assert.equal(owner.complete(old, { accepted: true, key: old.key }), null);
  assert.equal(owner.snapshot().index, 1);
  assert.equal(
    owner.beginTraversal(3, -1, () => {
      throw new Error("replaced");
    }),
    null,
  );
});

test("rejection, wrong-key, forged tickets, cancellation and lifetime changes cannot commit", () => {
  const owner = createSessionNavigationHistory(["B", "A"]);
  const first = owner.beginTraversal(1, -1, () => true)!;
  assert.equal(owner.complete({ ...first }, { accepted: true, key: "A" }), null);
  assert.equal(owner.complete(first, { accepted: true, key: "other" }), null);
  assert.equal(owner.snapshot().index, 1);
  const second = owner.beginTraversal(2, -1, () => true)!;
  owner.cancel();
  assert.equal(owner.complete(second, { accepted: true, key: "A" }), null);
  assert.equal(owner.beginVisit(2, "C"), null);
  const third = owner.beginVisit(3, "C")!;
  owner.dispose();
  assert.equal(owner.complete(third, { accepted: true, key: "C" }), null);
  assert.equal(owner.beginVisit(4, "D"), null);
  assert.deepEqual(owner.snapshot().entries, ["A", "B"]);
});

test("request zero is a valid initial browser request", () => {
  const owner = createSessionNavigationHistory(["B", "A"]);
  const initial = owner.beginVisit(0, "B");
  assert.ok(initial);
  owner.complete(initial, { accepted: true, key: "B" });
});

test("cancellation during fresh availability cannot rearm pending", () => {
  const owner = createSessionNavigationHistory(["B", "A"]);
  assert.equal(
    owner.beginTraversal(1, -1, () => {
      owner.cancel();
      return true;
    }),
    null,
  );
  assert.equal(owner.snapshot().pending, null);
  for (const attempt of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(owner.beginVisit(attempt, "C"), null);
});

test("stale attempts and old rejection leave newer traversal intact; forward commits on acceptance", () => {
  const owner = createSessionNavigationHistory(["C", "B", "A"]);
  const old = owner.beginTraversal(1, -1, () => true)!;
  const current = owner.beginTraversal(2, -1, () => true)!;
  assert.equal(owner.beginVisit(1, "D"), null);
  assert.equal(owner.complete(old, { accepted: false }), null);
  assert.deepEqual(owner.snapshot().pending, { attempt: 2, key: "B" });
  owner.complete(current, { accepted: true, key: "B" });
  const forward = owner.beginTraversal(3, 1, () => true)!;
  assert.equal(owner.snapshot().index, 1);
  owner.complete(forward, { accepted: true, key: "C" });
  assert.equal(owner.snapshot().index, 2);
});
