import type { ApplicationShellResourceV2, CanonicalDaemonInfo } from "@tmux-ide/contracts";
import { afterEach, expect, it, vi } from "vitest";
import { createHomeAgentObserver } from "./home-agent-observer.ts";
import { createHomeAgentTransport } from "./home-agent-transport.ts";

const daemon: CanonicalDaemonInfo = {
  pid: 1,
  port: 4000,
  protocolVersion: 1,
  productVersion: "test",
  instanceId: "11111111-1111-4111-8111-111111111111",
  startedAt: "2026-09-04T00:00:00.000Z",
  bindHostname: "127.0.0.1",
};
afterEach(() => vi.useRealTimers());
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function fixture() {
  vi.useFakeTimers();
  const reads: {
    session: string;
    resolve: (shell: ApplicationShellResourceV2) => void;
    reject: (error: Error) => void;
  }[] = [];
  // Different scoped generation uses the actual fallback poll, without opening a socket.
  const transport = createHomeAgentTransport({
    readDaemon: () => daemon,
    createSocket: () => {
      throw new Error("Unexpected socket in scoped polling fixture");
    },
  });
  const observer = createHomeAgentObserver({
    readDaemon: () => daemon,
    connect: transport.connect,
    fetchShell: (_daemon, session) =>
      new Promise<ApplicationShellResourceV2>((resolve, reject) => {
        reads.push({ session: session.id, resolve, reject });
      }),
  });
  observer.adoptCatalog({
    phase: "live",
    daemonInstanceId: daemon.instanceId,
    note: null,
    sessions: Array.from({ length: 3 }, (_, i) => ({
      id: `session-${i}`,
      name: `Session ${i}`,
      liveSessionId: `live-session.${String(i).repeat(20)}`,
      paneCount: 1,
      server: {
        serverId: `tmux-server.${"a".repeat(32)}`,
        generation: "22222222-2222-4222-8222-222222222222",
      },
    })),
  });
  observer.setActive(true);
  return { observer, reads };
}
it("advisory polling must not suppress a completed observation failure indefinitely", async () => {
  const f = fixture();
  try {
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    expect(f.reads.map((r) => r.session)).toEqual(["session-0", "session-1"]);
    await vi.advanceTimersByTimeAsync(6000);
    f.reads[0]!.reject(new Error("Controlled read deadline"));
    f.reads[1]!.reject(new Error("Controlled read deadline"));
    await settle();
    expect(f.observer.getSnapshot().unavailableSessions).toBeGreaterThan(0);
  } finally {
    f.observer.dispose();
  }
});
it("poll-dirtied leading slots must not starve a queued later session", async () => {
  const f = fixture();
  try {
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    for (let round = 0; round < 3; round++) {
      const pending = f.reads.slice(-2);
      await vi.advanceTimersByTimeAsync(6000);
      for (const read of pending) read.reject(new Error("Controlled read deadline"));
      await settle();
    }
    expect(f.reads.map((r) => r.session)).toContain("session-2");
  } finally {
    f.observer.dispose();
  }
});

it("authoritative invalidation still discards superseded reads while queued siblings progress", async () => {
  const f = fixture();
  try {
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    f.observer.invalidate();
    f.reads[0]!.reject(new Error("Superseded failure"));
    f.reads[1]!.reject(new Error("Superseded failure"));
    await settle();
    expect(f.observer.getSnapshot().unavailableSessions).toBe(0);
    expect(f.reads[2]!.session).toBe("session-2");
    expect(f.reads).toHaveLength(4);
  } finally {
    f.observer.dispose();
  }
});

it("a successful read slower than the advisory cadence publishes its observation", async () => {
  const f = fixture();
  try {
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    await vi.advanceTimersByTimeAsync(6000);
    // Only the renderer-neutral roster projection is exercised by this owner test.
    const shell = {
      version: 2,
      daemon,
      resource: { workspace: { sidebar: { agents: [] } } },
    } as unknown as ApplicationShellResourceV2;
    f.reads[0]!.resolve(shell);
    await settle();
    expect(f.observer.getSnapshot().observedSessions).toBe(1);
    expect(f.reads[2]!.session).toBe("session-2");
  } finally {
    f.observer.dispose();
  }
});
