import type { CanonicalDaemonInfo } from "@tmux-ide/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

const ws = vi.hoisted(() => ({
  constructed: [] as { url: string; options: unknown }[],
}));
vi.mock("ws", () => ({
  default: class {
    constructor(url: string, options: unknown) {
      ws.constructed.push({ url, options });
    }
    on() {}
    send() {}
    close() {}
  },
}));

import { createHomeAgentTransport } from "./home-agent-transport.ts";
import type { HomeCatalogSession } from "./home-catalog.ts";

// #11: Home must never call the daemon without its credential. These pin the
// client-side guards; the server gates are covered separately.
const base: CanonicalDaemonInfo = {
  pid: 1,
  port: 4000,
  protocolVersion: 1,
  productVersion: "test",
  instanceId: "11111111-1111-4111-8111-111111111111",
  startedAt: "2026-09-04T00:00:00.000Z",
  bindHostname: "127.0.0.1",
};
const tokenless: [string, CanonicalDaemonInfo][] = [
  ["omitted", base],
  ["null", { ...base, authToken: null }],
];
const withToken: CanonicalDaemonInfo = { ...base, authToken: "secret" };
const legacy: HomeCatalogSession = {
  id: "legacy",
  name: "work",
  liveSessionId: `live-session.${"0".repeat(20)}`,
  paneCount: 1,
};
const scoped: HomeCatalogSession = {
  ...legacy,
  id: "scoped",
  server: {
    serverId: `tmux-server.${"a".repeat(32)}`,
    generation: "22222222-2222-4222-8222-222222222222",
  },
};
const handlers = () => ({ ready: vi.fn(), invalidate: vi.fn(), unavailable: vi.fn() });

afterEach(() => {
  ws.constructed.length = 0;
});

describe("fetchShell credential guard", () => {
  it.each(tokenless)("rejects without calling fetch when the token is %s", async (_, daemon) => {
    const fetch = vi.fn();
    const transport = createHomeAgentTransport({ readDaemon: () => daemon, fetch });
    for (const session of [legacy, scoped])
      await expect(
        transport.fetchShell(daemon, session, new AbortController().signal),
      ).rejects.toThrow("Daemon credential is unavailable.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the bearer token when the credential is present", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 500 }));
    const transport = createHomeAgentTransport({ readDaemon: () => withToken, fetch });
    await expect(
      transport.fetchShell(withToken, legacy, new AbortController().signal),
    ).rejects.toThrow("HTTP 500");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![1]).toMatchObject({
      headers: { Authorization: "Bearer secret" },
    });
  });
});

describe("default event socket credential guard", () => {
  it.each(tokenless)(
    "opens no socket and reports unavailable when the token is %s",
    (_, daemon) => {
      const transport = createHomeAgentTransport({ readDaemon: () => daemon });
      const h = handlers();
      transport.connect(daemon, [legacy], h).close();
      expect(h.unavailable).toHaveBeenCalledOnce();
      expect(ws.constructed).toHaveLength(0);
    },
  );

  it("opens the socket with the bearer token when the credential is present", () => {
    const transport = createHomeAgentTransport({ readDaemon: () => withToken });
    const h = handlers();
    transport.connect(withToken, [legacy], h).close();
    expect(h.unavailable).not.toHaveBeenCalled();
    expect(ws.constructed).toHaveLength(1);
    expect(ws.constructed[0]!.options).toEqual({ headers: { Authorization: "Bearer secret" } });
  });
});
