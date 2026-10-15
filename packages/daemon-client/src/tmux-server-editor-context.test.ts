import { expect, it } from "bun:test";
import { createTmuxServerClient } from "./tmux-server-client.ts";
const scope = {
  serverId: `tmux-server.${"a".repeat(32)}`,
  generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
const target = {
  generation: scope.generation,
  workspaceName: "project",
  liveSessionId: `live-session.${"b".repeat(20)}`,
  semanticPaneId: "pane.main",
};
const envelope = () => ({
  version: 1,
  server: { ...scope },
  context: {
    ...target,
    directory: "/private/工作 ",
    cwd: { kind: "absolute", path: "/private/工作 " },
  },
});
const client = (fetcher: (url: URL, init: RequestInit) => Promise<Response>) =>
  createTmuxServerClient(
    {
      baseUrl: "http://localhost:4000",
      ownerToken: "test-owner",
      hostClientId: "test",
      origin: "tmux-ide://app",
      fetch: fetcher as typeof fetch,
    },
    scope,
  );
it("reads authenticated exact scoped context without converting directories or permitting redirects/cache", async () => {
  const c = client(async (url, init) => {
    expect(url.pathname).toBe(
      `/api/v1/tmux-servers/${scope.serverId}/${scope.generation}/pane-editor-context`,
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(target);
    expect(init.headers).toEqual({
      Authorization: "Bearer test-owner",
      "Content-Type": "application/json",
    });
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    return Response.json(envelope());
  });
  expect(await c.paneEditorContext(target)).toEqual(envelope());
});
it("rejects every mismatched identity and malformed private response with safe errors", async () => {
  for (const patch of [
    { workspaceName: "other" },
    { semanticPaneId: "other" },
    { liveSessionId: `live-session.${"c".repeat(20)}` },
  ]) {
    const response = envelope();
    Object.assign(response.context, patch);
    await expect(
      client(async () => Response.json(response)).paneEditorContext(target),
    ).rejects.toMatchObject({ code: "scope-mismatch" });
  }
  const response = envelope();
  response.server.serverId = `tmux-server.${"c".repeat(32)}`;
  await expect(
    client(async () => Response.json(response)).paneEditorContext(target),
  ).rejects.toMatchObject({ code: "scope-mismatch" });
  response.context.directory = "private/secret-relative";
  await expect(
    client(async () => Response.json(response)).paneEditorContext(target),
  ).rejects.toThrow("Invalid editor context response");
});
it("detaches caller target and refuses disposal/abort after delayed fetch", async () => {
  for (const mode of ["mutate", "dispose", "abort"] as const) {
    let finish!: () => void;
    const barrier = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const c = client(async () => {
      await barrier;
      return Response.json(envelope());
    });
    const input = { ...target };
    const abort = new AbortController();
    const pending = c.paneEditorContext(input, abort.signal);
    if (mode === "mutate") input.semanticPaneId = "changed";
    if (mode === "dispose") c.dispose();
    if (mode === "abort") abort.abort();
    finish();
    if (mode === "mutate") expect(await pending).toEqual(envelope());
    else await expect(pending).rejects.toThrow();
  }
});
it("rejects invalid input/generation and pre-aborted reads before fetching", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return Response.json(envelope());
  });
  await expect(
    c.paneEditorContext({ ...target, generation: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
  ).rejects.toThrow();
  await expect(c.paneEditorContext(target, AbortSignal.abort())).rejects.toThrow();
  await expect(c.paneEditorContext({ ...target, directory: "/caller" })).rejects.toThrow();
  expect(calls).toBe(0);
});
