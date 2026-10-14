import { expect, it } from "bun:test";
import { createTmuxServerClient } from "./tmux-server-client.ts";
const server = {
  serverId: `tmux-server.${"a".repeat(32)}`,
  generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
const session = `live-session.${"b".repeat(20)}`;
const target = {
  observedPaneId: `terminal.discovered.${"a".repeat(20)}`,
  observedAgentId: `agent.${"b".repeat(20)}`,
};
const response = () => ({
  version: 1,
  server: { ...server },
  workspaceName: "project",
  liveSessionId: session,
  semanticPaneId: "pane.promoted",
});
const client = (fetcher: typeof fetch) =>
  createTmuxServerClient(
    {
      baseUrl: "http://localhost:4000",
      ownerToken: "test-owner",
      hostClientId: "test",
      origin: "tmux-ide://app",
      fetch: fetcher,
    },
    server,
  );
it("sends one authenticated detached admission request and validates result", async () => {
  let calls = 0;
  const c = client((async (url, init) => {
    calls++;
    expect(String(url)).toEndWith(`/sessions/${session}/open-agent`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      Authorization: "Bearer test-owner",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init!.body as string)).toEqual(target);
    expect(init?.redirect).toBe("error");
    return Response.json(response());
  }) as typeof fetch);
  expect((await c.openAgent(session, target)).semanticPaneId).toBe("pane.promoted");
  expect(calls).toBe(1);
});
it("rejects wrong session/scope, malformed results and never retries", async () => {
  for (const changed of [
    { ...response(), liveSessionId: `live-session.${"c".repeat(20)}` },
    { ...response(), server: { ...server, generation: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } },
    { ...response(), semanticPaneId: target.observedPaneId },
  ]) {
    let calls = 0;
    const c = client((async () => {
      calls++;
      return Response.json(changed);
    }) as typeof fetch);
    await expect(c.openAgent(session, target)).rejects.toThrow();
    expect(calls).toBe(1);
  }
});
it("refuses invalid targets before IO and late replies after abort/dispose", async () => {
  let calls = 0;
  const c = client((async () => {
    calls++;
    return Response.json(response());
  }) as typeof fetch);
  await expect(c.openAgent(session, { ...target, observedPaneId: "%1" })).rejects.toThrow();
  expect(calls).toBe(0);
  for (const retire of ["abort", "dispose"]) {
    const abort = new AbortController();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const owner = client((async () => {
      await pending;
      return Response.json(response());
    }) as typeof fetch);
    const result = owner.openAgent(session, target, abort.signal);
    if (retire === "abort") abort.abort();
    else owner.dispose();
    release();
    await expect(result).rejects.toThrow();
  }
});
