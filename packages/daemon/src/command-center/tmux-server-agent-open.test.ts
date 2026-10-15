import { Hono } from "hono";
import { expect, it, vi } from "vitest";
import { TmuxServerOwners } from "../lib/tmux-server-owners.ts";
import type { NativeTmuxServerOwner } from "../lib/tmux-server-owner.ts";
import { mountTmuxServerRoutes } from "./tmux-servers.ts";
const session = `live-session.${"b".repeat(20)}`;
const target = {
  observedPaneId: `terminal.discovered.${"a".repeat(20)}`,
  observedAgentId: `agent.${"b".repeat(20)}`,
};
async function fixture() {
  const openAgent = vi.fn(async (liveSessionId: string) => ({
    liveSessionId,
    workspaceName: "project",
    semanticPaneId: "pane.promoted",
  }));
  const owners = new TmuxServerOwners<NativeTmuxServerOwner>({
    probe: async (selector) => ({
      fingerprint: JSON.stringify(selector),
      authority: { executablePath: "/fixture/tmux", socketSelector: selector },
      valid: () => true,
    }),
    create: async () =>
      ({ openAgent, dispose: async () => {} }) as unknown as NativeTmuxServerOwner,
  });
  const server = await owners.register({
    label: "fixture",
    selector: { kind: "name", name: "fixture" },
  });
  const app = new Hono();
  mountTmuxServerRoutes(app, { owners, ownerToken: "test-owner" });
  const path = `/api/v1/tmux-servers/${server.serverId}/${server.generation}/sessions/${session}/open-agent`;
  const request = (body: unknown = target, auth: string | null = "test-owner", url = path) =>
    app.request(url, {
      method: "POST",
      headers: {
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  return { owners, server, openAgent, request, path };
}
it("requires mounted authentication, bounded strict body and exact owner scope", async () => {
  const f = await fixture();
  for (const auth of [null, "wrong"]) expect((await f.request(target, auth)).status).toBe(401);
  for (const invalid of [
    { ...target, observedPaneId: "%1" },
    { ...target, rawSocket: "private" },
    { ...target, extra: "x".repeat(9000) },
  ])
    expect((await f.request(invalid)).status).toBe(400);
  expect(
    (
      await f.request(
        target,
        "test-owner",
        f.path.replace(f.server.generation!, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
      )
    ).status,
  ).toBe(409);
  expect(f.openAgent).not.toHaveBeenCalled();
  const response = await f.request();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    version: 1,
    server: { serverId: f.server.serverId, generation: f.server.generation },
    workspaceName: "project",
    liveSessionId: session,
    semanticPaneId: "pane.promoted",
  });
  expect(f.openAgent).toHaveBeenCalledWith(session, target);
  await f.owners.dispose();
});
it("refuses retired owner replies and does not disclose owner diagnostics", async () => {
  const f = await fixture();
  f.openAgent.mockRejectedValueOnce(new Error("private/raw/socket"));
  const failure = await f.request();
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain("private");
  let release!: () => void;
  const pending = new Promise<void>((r) => {
    release = r;
  });
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  f.openAgent.mockImplementationOnce(async (liveSessionId) => {
    entered();
    await pending;
    return { liveSessionId, workspaceName: "project", semanticPaneId: "pane.promoted" };
  });
  const reply = f.request();
  await started;
  await f.owners.remove(f.server.serverId);
  release();
  const retired = await reply;
  expect(retired.status).toBe(404);
  expect(await retired.json()).toEqual({ error: { code: "not-found" } });
  await f.owners.dispose();
});
