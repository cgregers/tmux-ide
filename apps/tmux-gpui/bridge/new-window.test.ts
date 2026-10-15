import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createNewWindowExecutor, confirmsNewWindow, type NewWindowTarget } from "./new-window.ts";
import { paneActionSchema } from "./pane-actions.ts";
import type { Layout } from "./topology.ts";
function fixture() {
  let target: NewWindowTarget | null = {
    token: randomUUID(),
    id: "source",
    generation: randomUUID(),
    workspace: "workspace",
    window: "window",
    lifetime: "birth",
    session: "session",
    presenceRevision: 1,
  };
  let input = true,
    geometry = true,
    calls = 0;
  const runtime = {
    ownsConnectionAuthority: (kind: string) => (kind === "input" ? input : geometry),
    requestAuthority: async () => {
      geometry = true;
      return {} as never;
    },
  };
  const client = {
    createPane: async (operationId: string, intent: unknown, session: string) => {
      calls++;
      assert.deepEqual(intent, {
        workspaceName: "workspace",
        kind: "terminal",
        placement: { kind: "window" },
      });
      assert.equal(session, "session");
      return {
        operationId,
        daemonInstanceId: target!.generation,
        outcome: "created" as const,
        resource: {
          resourceVersion: 1 as const,
          workspaceName: "workspace",
          semanticPaneId: "created",
          displayTitle: "Terminal",
          kind: "terminal" as const,
          harnessProfileId: null,
          role: null,
          missionId: null,
        },
      };
    },
  };
  return {
    runtime,
    client,
    current: () => target,
    set: (value: NewWindowTarget | null) => {
      target = value;
    },
    revoke: () => {
      input = false;
    },
    unown: () => {
      geometry = false;
    },
    calls: () => calls,
  };
}
test("new window uses exact scoped owner request once and strict action wire", async () => {
  const f = fixture(),
    execute = createNewWindowExecutor();
  const command = {
    type: "pane-action",
    request: 2,
    id: "source",
    token: f.current()!.token,
    action: "new-window",
  };
  assert.ok(paneActionSchema.safeParse(command).success);
  assert.equal(
    paneActionSchema.safeParse({ ...command, placement: { kind: "pane" } }).success,
    false,
  );
  assert.equal((await execute(f.client, f.runtime, f.current))?.resource.semanticPaneId, "created");
  assert.equal(await execute(f.client, f.runtime, f.current), null);
  assert.equal(f.calls(), 1);
});
test("pending geometry consumes duplicates and rejects changed presence before effect", async () => {
  const f = fixture(),
    execute = createNewWindowExecutor();
  f.unown();
  let release!: () => void;
  const acquire = f.runtime.requestAuthority;
  f.runtime.requestAuthority = () =>
    new Promise((done) => {
      release = () => {
        void acquire().then(done);
      };
    });
  const pending = execute(f.client, f.runtime, f.current);
  assert.equal(await execute(f.client, f.runtime, f.current), null);
  f.set({ ...f.current()!, presenceRevision: 3 });
  release();
  assert.equal(await pending, null);
  assert.equal(f.runtime.ownsConnectionAuthority("geometry"), true);
  assert.equal(f.calls(), 0);
});
for (const field of ["presenceRevision", "lifetime", "session"] as const)
  test(`late receipt cannot navigate after ${field} changes`, async () => {
    const f = fixture(),
      execute = createNewWindowExecutor(),
      original = f.client.createPane;
    f.client.createPane = async (...args) => {
      const result = await original(...args);
      f.set({ ...f.current()!, [field]: field === "presenceRevision" ? 3 : "replacement" });
      return result;
    };
    assert.equal(await execute(f.client, f.runtime, f.current), null);
    assert.equal(f.calls(), 1);
  });
for (const field of [
  "operationId",
  "daemonInstanceId",
  "workspaceName",
  "replayed",
  "same-pane",
] as const)
  test(`rejects ${field} receipt without replay`, async () => {
    const f = fixture(),
      execute = createNewWindowExecutor(),
      original = f.client.createPane;
    f.client.createPane = async (...args) => {
      const result = await original(...args);
      return {
        ...result,
        ...(field === "operationId" || field === "daemonInstanceId"
          ? { [field]: randomUUID() }
          : {}),
        ...(field === "replayed" ? { outcome: "replayed" as "created" } : {}),
        resource: {
          ...result.resource,
          ...(field === "workspaceName" ? { workspaceName: "wrong" } : {}),
          ...(field === "same-pane" ? { semanticPaneId: "source" } : {}),
        },
      };
    };
    assert.equal(await execute(f.client, f.runtime, f.current), null);
    assert.equal(await execute(f.client, f.runtime, f.current), null);
    assert.equal(f.calls(), 1);
  });
test("canonical topology must show unique original and created panes in distinct windows", () => {
  const layout = (window: string, panes: string[]) =>
    ({ semanticWindowId: window, panes: panes.map((pane) => ({ pane })) }) as Layout;
  assert.ok(
    confirmsNewWindow(
      [layout("window", ["source"]), layout("new", ["created"])],
      "source",
      "window",
      "created",
    ),
  );
  for (const layouts of [
    [layout("window", ["source", "created"])],
    [layout("new", ["created"])],
    [layout("window", ["source"]), layout("new", ["created"]), layout("other", ["created"])],
  ])
    assert.equal(confirmsNewWindow(layouts, "source", "window", "created"), false);
});
test("lost input before submission or after receipt cannot create or navigate respectively", async () => {
  const before = fixture();
  before.revoke();
  assert.equal(
    await createNewWindowExecutor()(before.client, before.runtime, before.current),
    null,
  );
  assert.equal(before.calls(), 0);
  const after = fixture(),
    original = after.client.createPane;
  after.client.createPane = async (...args) => {
    const receipt = await original(...args);
    after.revoke();
    return receipt;
  };
  assert.equal(await createNewWindowExecutor()(after.client, after.runtime, after.current), null);
  assert.equal(after.calls(), 1);
});
