import { test } from "node:test";
import assert from "node:assert/strict";
import { homeAgentPublication, openAgentSchema } from "./home-agent-publication.ts";
import type {
  HomeAgentRow,
  HomeAgentSnapshot,
} from "../../../packages/presentation/src/home-agent-roster.ts";
const row: HomeAgentRow = {
  key: "opaque\0route",
  sessionKey: "session",
  sessionName: "Workspace",
  liveSessionId: "live-session.aaaaaaaaaaaaaaaaaaaa",
  daemonInstanceId: "private-generation",
  agentId: "agent.private",
  paneId: "pane.agent",
  name: "Agent",
  harness: "",
  projectName: "",
  activity: "running",
  attention: true,
  nativeIdentity: null,
  interactionEndpoint: null,
};
const snapshot = (rows: HomeAgentRow[]): HomeAgentSnapshot => ({
  phase: "live",
  rows,
  observedSessions: 1,
  totalSessions: 1,
  loadingSessions: 0,
  unavailableSessions: 0,
  truncatedSessions: 0,
  refreshingSessionKeys: [],
  unavailableSessionKeys: [],
  note: null,
});
const keys = ["machineLabel", "serverLabel", "projectName", "harness", "teamName"] as const;
test("missing context is omitted, not fabricated from IDs or routing", () => {
  const result = homeAgentPublication(snapshot([row]), 1).rows[0]!;
  for (const key of keys) assert.equal(key in result, false);
  assert.equal(result.key, row.key);
  assert.equal(result.sessionLabel, row.sessionName);
  assert.equal(result.available, false);
});
test("shared context is sanitized and bounded without changing opaque route or admission", () => {
  const label = "\0\n\u001b\u007f\u0085" + "界🙂".repeat(100);
  const enriched = {
    ...row,
    machineLabel: label,
    serverLabel: label,
    projectName: label,
    harness: label,
    team: { id: "team.aaaaaaaaaaaaaaaa", name: label, source: "manual" as const },
  };
  const bare = homeAgentPublication(snapshot([row]), 2).rows[0]!;
  const shown = homeAgentPublication(snapshot([enriched]), 2).rows[0]!;
  for (const key of keys) {
    const value = shown[key];
    assert.equal(Array.from(value!).length, 160);
    assert.equal(value, "界🙂".repeat(80));
  }
  const { machineLabel, serverLabel, projectName, harness, teamName, ...unchanged } = shown;
  assert.deepEqual(unchanged, bare);
  assert.ok(machineLabel && serverLabel && projectName && harness && teamName);
  assert.deepEqual(
    openAgentSchema.parse({
      type: "open-agent",
      request: 2,
      fromRequest: 1,
      rosterRevision: 2,
      key: shown.key,
    }),
    { type: "open-agent", request: 2, fromRequest: 1, rosterRevision: 2, key: row.key },
  );
  assert.equal("team" in shown, false);
  assert.equal("daemonInstanceId" in shown, false);
  assert.equal(
    homeAgentPublication(snapshot([{ ...enriched, machineLabel: "\0\n" }]), 2).rows[0]!
      .machineLabel,
    undefined,
  );
});
test("maximum context remains bounded for simultaneous 256-row Home and attention rosters", () => {
  const label = "🙂".repeat(160);
  const rows = Array.from({ length: 300 }, (_, i) => ({
    ...row,
    key: String(i),
    machineLabel: label,
    serverLabel: label,
    projectName: label,
    harness: label,
    team: { id: "team.aaaaaaaaaaaaaaaa", name: label, source: "manual" as const },
  }));
  const result = homeAgentPublication(snapshot(rows), 3);
  assert.equal(result.rows.length, 256);
  assert.equal(result.truncatedRows, 44);
  assert.ok(
    Buffer.byteLength(JSON.stringify({ homeAgents: result, attentionAgents: result })) <
      3 * 1024 * 1024,
  );
});
