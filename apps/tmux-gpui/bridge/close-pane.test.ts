import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { closePane, confirmsClosedPane, createClosePanePreflight } from "./close-pane.ts";
import type { NewWindowTarget } from "./new-window.ts";
const target = (): NewWindowTarget => ({
  token: randomUUID(),
  id: "pane-a",
  generation: randomUUID(),
  workspace: "workspace",
  window: "window-a",
  lifetime: "birth-a",
  session: "session-a",
  presenceRevision: 1,
});
test("close consumes preflight once and captures exact target across geometry await", async () => {
  const original = target();
  let now = { ...original };
  let geometry = false;
  let release!: () => void;
  const runtime = {
    ownsConnectionAuthority: (kind: string) => kind === "input" || geometry,
    requestAuthority: () =>
      new Promise<never>((done) => {
        release = () => {
          geometry = true;
          done({} as never);
        };
      }),
  };
  const prepare = createClosePanePreflight();
  const pending = prepare(runtime, () => now);
  assert.equal(await prepare(runtime, () => now), null);
  now = { ...now, lifetime: "replacement" };
  release();
  assert.equal(await pending, null);
  assert.equal(geometry, true);
});
test("close preflight requires current input and geometry, allows exact ready target", async () => {
  const row = target();
  let input = false;
  const runtime = {
    ownsConnectionAuthority: (kind: string) => kind !== "input" || input,
    requestAuthority: async () => null,
  };
  const prepare = createClosePanePreflight();
  assert.equal(await prepare(runtime, () => row), null);
  input = true;
  assert.deepEqual(await prepare(runtime, () => row), row);
  assert.equal(await prepare(runtime, () => row), null);
});
test("close receipt accepts target disappearance but retains owner request/presence admission", async () => {
  const row = target();
  let livePane = true;
  let calls = 0;
  assert.equal(
    await closePane({
      current: () => true,
      generation: row.generation,
      workspace: row.workspace,
      pane: row.id,
      submit: async (operationId) => {
        calls++;
        livePane = false;
        return {
          operationId,
          daemonInstanceId: row.generation,
          workspaceName: row.workspace,
          verb: "workspace.pane.kill",
          outcome: "applied",
          windowClosed: false,
          remainingWindowCount: 1,
        };
      },
    }),
    true,
  );
  assert.equal(livePane, false);
  assert.equal(calls, 1);
});
for (const mismatch of ["operation", "generation", "workspace", "replayed", "owner"] as const)
  test(`close rejects ${mismatch} result with no retry`, async () => {
    const row = target();
    let current = true,
      calls = 0;
    const action = closePane({
      current: () => current,
      generation: row.generation,
      workspace: row.workspace,
      pane: row.id,
      submit: async (operationId) => {
        calls++;
        if (mismatch === "owner") current = false;
        return {
          operationId: mismatch === "operation" ? randomUUID() : operationId,
          daemonInstanceId: mismatch === "generation" ? randomUUID() : row.generation,
          workspaceName: mismatch === "workspace" ? "other" : row.workspace,
          verb: "workspace.pane.kill",
          outcome: mismatch === "replayed" ? "replayed" : "applied",
          windowClosed: false,
          remainingWindowCount: 1,
        };
      },
    });
    if (mismatch === "owner") assert.equal(await action, false);
    else await assert.rejects(action, /not confirmed/);
    assert.equal(calls, 1);
  });
test("absence settlement rejects retained target, duplicate catalog and oversized inventory", () => {
  assert.ok(confirmsClosedPane(["survivor"], "killed"));
  assert.ok(confirmsClosedPane([], "killed"));
  for (const ids of [
    ["killed", "survivor"],
    ["survivor", "survivor"],
    Array.from({ length: 513 }, (_, i) => String(i)),
  ])
    assert.equal(confirmsClosedPane(ids, "killed"), false);
});
