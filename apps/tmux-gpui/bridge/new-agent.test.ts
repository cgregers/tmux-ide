import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createNewWindowExecutor, type NewWindowTarget } from "./new-window.ts";
import { paneActionSchema } from "./pane-actions.ts";
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
        kind: "agent",
        displayTitle: "Agent ; $(not-a-command)",
        harnessProfileId: "claude",
        role: "implementer",
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
          displayTitle: "Agent ; $(not-a-command)",
          kind: "agent" as const,
          harnessProfileId: "claude",
          role: "implementer" as const,
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
const agent = { name: "Agent ; $(not-a-command)", harness: "claude" as const };
test("agent owner creation is structured, exact and one-shot", async () => {
  const f = fixture(),
    execute = createNewWindowExecutor();
  assert.equal((await execute(f.client, f.runtime, f.current, agent))?.resource.kind, "agent");
  assert.equal(await execute(f.client, f.runtime, f.current, agent), null);
  assert.equal(f.calls(), 1);
});
for (const field of ["displayTitle", "harnessProfileId", "role", "kind", "missionId"] as const)
  test(`agent receipt rejects wrong ${field}`, async () => {
    const f = fixture(),
      original = f.client.createPane;
    f.client.createPane = async (...args) => {
      const value = await original(...args);
      return { ...value, resource: { ...value.resource, [field]: "wrong" } };
    };
    assert.equal(await createNewWindowExecutor()(f.client, f.runtime, f.current, agent), null);
  });
test("invalid agent names and harnesses never reach the owner", async () => {
  const f = fixture();
  const command = {
    type: "pane-action",
    request: 1,
    id: "source",
    token: f.current()!.token,
    action: "new-agent",
    ...agent,
  };
  assert.ok(paneActionSchema.safeParse(command).success);
  for (const name of ["", " untrimmed", "a\n", "🙂".repeat(41)])
    assert.equal(paneActionSchema.safeParse({ ...command, name }).success, false);
  assert.equal(paneActionSchema.safeParse({ ...command, harness: "sh" }).success, false);
  await assert.rejects(
    createNewWindowExecutor()(f.client, f.runtime, f.current, { ...agent, name: "" }),
  );
  assert.equal(f.calls(), 0);
});
test("agent awaits geometry and rejects a foreground cycle without mutation", async () => {
  const f = fixture();
  f.unown();
  let release!: () => void;
  const acquire = f.runtime.requestAuthority;
  f.runtime.requestAuthority = () =>
    new Promise((done) => {
      release = () => {
        void acquire().then(done);
      };
    });
  const execute = createNewWindowExecutor();
  const pending = execute(f.client, f.runtime, f.current, agent);
  assert.equal(await execute(f.client, f.runtime, f.current, agent), null);
  f.set({ ...f.current()!, presenceRevision: 3 });
  release();
  assert.equal(await pending, null);
  assert.equal(f.runtime.ownsConnectionAuthority("geometry"), true);
  assert.equal(f.calls(), 0);
});
