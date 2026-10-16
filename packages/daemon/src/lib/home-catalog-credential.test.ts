import type { CanonicalDaemonInfo } from "@tmux-ide/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ws = vi.hoisted(() => ({
  constructed: [] as { url: string; options: unknown }[],
}));
vi.mock("ws", () => ({
  default: class {
    readyState = 0;
    constructor(url: string, options: unknown) {
      ws.constructed.push({ url, options });
    }
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  },
}));

import { createHomeCatalogAdapter, type HomeCatalogTarget } from "./home-catalog.ts";

// #11: Home's catalog must never call the daemon without its credential.
const base: CanonicalDaemonInfo = {
  pid: 1,
  port: 4000,
  protocolVersion: 1,
  productVersion: "test",
  instanceId: "11111111-1111-4111-8111-111111111111",
  startedAt: "2026-09-04T00:00:00.000Z",
  bindHostname: "127.0.0.1",
};
const target = (daemon: CanonicalDaemonInfo): HomeCatalogTarget => ({
  daemon,
  workspaceName: "work",
});
const tokenless: [string, CanonicalDaemonInfo][] = [
  ["omitted", base],
  ["null", { ...base, authToken: null }],
];
const withToken: CanonicalDaemonInfo = { ...base, authToken: "secret" };
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

let fetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetch = vi.fn(async () => new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  ws.constructed.length = 0;
});

describe("catalog fetch credential guard", () => {
  it.each(tokenless)("fails without calling fetch when the token is %s", async (_, daemon) => {
    const result = await createHomeCatalogAdapter(() => {}).fetch(
      target(daemon),
      "live-catalog",
      new AbortController().signal,
    );
    expect(result).toMatchObject({ status: "failed" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the bearer token when the credential is present", async () => {
    await createHomeCatalogAdapter(() => {}).fetch(
      target(withToken),
      "live-catalog",
      new AbortController().signal,
    );
    expect(fetch).toHaveBeenCalled();
    expect(fetch.mock.calls[0]![1]).toMatchObject({
      headers: { Authorization: "Bearer secret" },
    });
  });
});

describe("catalog push credential guard", () => {
  it.each(tokenless)("opens no socket when the token is %s", async (_, daemon) => {
    vi.useFakeTimers();
    const invalidate = vi.fn();
    const controller = new AbortController();
    await createHomeCatalogAdapter(() => {}).connect(
      target(daemon),
      [],
      { invalidate } as never,
      controller.signal,
    );
    await settle();
    // Each tick invalidates and retries the push: the timer is alive, the guard holds.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(ws.constructed).toHaveLength(0);
    controller.abort();
  });

  it("opens the socket with the bearer token when the credential is present", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    await createHomeCatalogAdapter(() => {}).connect(
      target(withToken),
      [],
      { invalidate: vi.fn() } as never,
      controller.signal,
    );
    await settle();
    expect(ws.constructed).toHaveLength(1);
    expect(ws.constructed[0]!.options).toEqual({ headers: { Authorization: "Bearer secret" } });
    controller.abort();
  });
});
