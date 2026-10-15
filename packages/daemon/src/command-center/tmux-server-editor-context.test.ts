import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { expect, it, vi } from "vitest";
import { TmuxServerOwners } from "../lib/tmux-server-owners.ts";
import type { NativeTmuxServerOwner } from "../lib/tmux-server-owner.ts";
import { mountTmuxServerRoutes } from "./tmux-servers.ts";

async function fixture() {
  const resolve = vi.fn(
    async (target: Parameters<NativeTmuxServerOwner["resolvePaneEditorContext"]>[0]) => ({
      ...target,
      directory: "/private/工作 ",
      cwd: { kind: "absolute" as const, path: "/private/工作 " },
    }),
  );
  const owners = new TmuxServerOwners<NativeTmuxServerOwner>({
    probe: async (selector) => ({
      fingerprint: JSON.stringify(selector),
      authority: { executablePath: "/fixture/tmux", socketSelector: selector },
      valid: () => true,
    }),
    create: async () =>
      ({
        resolvePaneEditorContext: resolve,
        dispose: async () => {},
      }) as unknown as NativeTmuxServerOwner,
  });
  const server = await owners.register({
    label: "fixture",
    selector: { kind: "name", name: "fixture" },
  });
  const target = {
    generation: server.generation!,
    workspaceName: "project",
    liveSessionId: `live-session.${"b".repeat(20)}`,
    semanticPaneId: "pane.main",
  };
  const app = new Hono();
  mountTmuxServerRoutes(app, { owners, ownerToken: "test-owner" });
  const path = `/api/v1/tmux-servers/${server.serverId}/${server.generation}/pane-editor-context`;
  const request = (body: unknown = target, auth: string | null = "test-owner", url = path) =>
    app.request(url, {
      method: "POST",
      headers: {
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  return { app, owners, server, target, resolve, path, request };
}
it("requires actual mounted owner auth before resolving, and returns no-store exact context", async () => {
  const f = await fixture();
  for (const auth of [null, "wrong"]) expect((await f.request(f.target, auth)).status).toBe(401);
  expect(f.resolve).not.toHaveBeenCalled();
  const response = await f.request();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    version: 1,
    server: { serverId: f.server.serverId, generation: f.server.generation },
    context: {
      ...f.target,
      directory: "/private/工作 ",
      cwd: { kind: "absolute", path: "/private/工作 " },
    },
  });
});
it("rejects malformed/foreign scopes, target generations, caller paths and oversized streaming bodies before owner calls", async () => {
  const f = await fixture();
  expect((await f.request({ ...f.target, generation: randomUUID() })).status).toBe(409);
  expect((await f.request({ ...f.target, directory: "/caller" })).status).toBe(400);
  expect(
    (await f.request(f.target, "test-owner", f.path.replace(f.server.generation!, randomUUID())))
      .status,
  ).toBe(409);
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(" ".repeat(4096)));
      c.enqueue(new TextEncoder().encode(" ".repeat(4097)));
      c.close();
    },
  });
  const response = await f.app.request(
    new Request(`http://localhost${f.path}`, {
      method: "POST",
      headers: { Authorization: "Bearer test-owner" },
      body: stream,
      duplex: "half",
    } as RequestInit),
  );
  expect(response.status).toBe(400);
  expect(f.resolve).not.toHaveBeenCalled();
});
it("hides owner errors for unknown workspace or pane and rejects wrong returned identity", async () => {
  const f = await fixture();
  for (const patch of [
    { workspaceName: "missing" },
    { semanticPaneId: "missing" },
    { liveSessionId: `live-session.${"c".repeat(20)}` },
  ]) {
    f.resolve.mockRejectedValueOnce(new Error("/private/secret cwd unavailable"));
    const response = await f.request({ ...f.target, ...patch });
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":{"code":"editor-context-unavailable"}}');
  }
  f.resolve.mockResolvedValueOnce({
    ...f.target,
    semanticPaneId: "wrong",
    directory: "/private/工作 ",
    cwd: { kind: "absolute", path: "/private/工作 " },
  });
  expect((await f.request()).status).toBe(503);
});
it("withholds a completed observation when its owner retires during the await", async () => {
  const f = await fixture();
  let finish!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  f.resolve.mockImplementationOnce(async (target) => {
    started();
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return { ...target, directory: "/private/a", cwd: { kind: "absolute", path: "/private/a" } };
  });
  const pending = f.request();
  await entered;
  await f.owners.remove(f.server.serverId);
  finish();
  const response = await pending;
  expect(response.status).toBe(404);
  expect(await response.text()).not.toContain("/private");
});

it("passes cancellation to the owner and withholds its late completed observation", async () => {
  const f = await fixture();
  const abort = new AbortController();
  let finish!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  f.resolve.mockImplementationOnce(async (target, signal?: AbortSignal) => {
    started();
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    expect(signal?.aborted).toBe(true);
    return { ...target, directory: "/private/a", cwd: { kind: "absolute", path: "/private/a" } };
  });
  const pending = f.app.request(f.path, {
    method: "POST",
    headers: { Authorization: "Bearer test-owner", "Content-Type": "application/json" },
    body: JSON.stringify(f.target),
    signal: abort.signal,
  });
  await entered;
  abort.abort();
  finish();
  const response = await pending;
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('{"error":{"code":"editor-context-unavailable"}}');
});
