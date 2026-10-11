import { expect, it } from "vitest";
import { TmuxAgentOpenRequestSchemaZ, TmuxAgentOpenResponseSchemaZ } from "../tmux-agent-open.ts";
const request = {
  observedPaneId: `terminal.discovered.${"a".repeat(20)}`,
  observedAgentId: `agent.${"b".repeat(20)}`,
};
it("accepts observed discovered identity but refuses raw transport targets and extra routing", () => {
  expect(TmuxAgentOpenRequestSchemaZ.parse(request)).toEqual(request);
  for (const input of [
    { ...request, observedPaneId: "%1" },
    { ...request, observedAgentId: "raw agent" },
    { ...request, socket: "/tmp/tmux" },
  ])
    expect(TmuxAgentOpenRequestSchemaZ.safeParse(input).success).toBe(false);
});
it("requires an attachable result and strict scoped envelope", () => {
  const response = {
    version: 1,
    server: {
      serverId: `tmux-server.${"a".repeat(32)}`,
      generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    },
    workspaceName: "project",
    liveSessionId: `live-session.${"b".repeat(20)}`,
    semanticPaneId: "pane.promoted",
  };
  expect(TmuxAgentOpenResponseSchemaZ.safeParse(response).success).toBe(true);
  for (const value of [
    { ...response, semanticPaneId: request.observedPaneId },
    { ...response, workspaceName: "raw session " },
    { ...response, paneId: "%1" },
  ])
    expect(TmuxAgentOpenResponseSchemaZ.safeParse(value).success).toBe(false);
});
