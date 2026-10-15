import { test } from "node:test";
import assert from "node:assert/strict";
import type { HomeAgentRow } from "../../../packages/presentation/src/home-agent-roster.ts";
import { admitFleetAgent, discoveredAgentRequest } from "./fleet-agent-admission.ts";
const row: HomeAgentRow = {
  key: "opaque",
  sessionKey: "session",
  sessionName: "Session",
  liveSessionId: "live-session.aaaaaaaaaaaaaaaaaaaa",
  daemonInstanceId: "generation",
  server: {
    serverId: "tmux-server." + "a".repeat(32),
    generation: "11111111-1111-4111-8111-111111111111",
  },
  agentId: "agent.aaaaaaaaaaaaaaaaaaaa",
  paneId: "terminal.discovered.aaaaaaaaaaaaaaaaaaaa",
  name: "Agent",
  harness: "codex",
  activity: "running",
  attention: true,
  projectName: "Project",
  nativeIdentity: null,
  interactionEndpoint: null,
};
const admitted = {
  version: 1,
  server: row.server!,
  workspaceName: "workspace",
  liveSessionId: row.liveSessionId,
  semanticPaneId: "pane.promoted",
};
const bound: HomeAgentRow = {
  ...row,
  paneId: admitted.semanticPaneId,
  nativeIdentity: { serverEpoch: "11111111-1111-4111-8111-111111111111", paneBirthId: "1" },
};
function fixture() {
  let current = true;
  let rows = [bound];
  let calls = 0;
  return {
    stale() {
      current = false;
    },
    rows(value: HomeAgentRow[]) {
      rows = value;
    },
    calls: () => calls,
    run(
      open: () => Promise<unknown> = async () => admitted,
      route: () => Promise<unknown> = async () => undefined,
    ) {
      return admitFleetAgent(
        row,
        async (request) => {
          calls++;
          assert.deepEqual(request, { observedPaneId: row.paneId, observedAgentId: row.agentId });
          return open();
        },
        async () => rows,
        route,
        () => current,
      );
    },
  };
}
test("discovered admission maps daemon result once; bound or invalid rows cannot mint admission", async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), admitted);
  assert.equal(f.calls(), 1);
  assert.equal(discoveredAgentRequest(bound), null);
  assert.equal(discoveredAgentRequest({ ...row, agentId: "bad" }), null);
  assert.equal(discoveredAgentRequest({ ...row, disabled: true }), null);
});
test("missing, ambiguous or unavailable post-promotion rows refuse without fallback", async () => {
  for (const rows of [[], [bound, bound], [{ ...bound, disabled: true }]]) {
    const f = fixture();
    f.rows(rows);
    await assert.rejects(f.run());
    assert.equal(f.calls(), 1);
  }
  const f = fixture();
  await assert.rejects(
    f.run(async () => {
      throw new Error("404");
    }),
  );
  assert.equal(f.calls(), 1);
});
test("scope and cancellation are fenced across admission and route verification", async () => {
  const f = fixture();
  await assert.rejects(
    f.run(async () => ({ ...admitted, liveSessionId: "live-session.bbbbbbbbbbbbbbbbbbbb" })),
  );
  const g = fixture();
  await assert.rejects(
    g.run(async () => {
      g.stale();
      return admitted;
    }),
  );
  const h = fixture();
  await assert.rejects(
    h.run(undefined, async () => {
      h.stale();
    }),
  );
  const i = fixture();
  i.stale();
  await assert.rejects(i.run());
  assert.equal(i.calls(), 0);
});
