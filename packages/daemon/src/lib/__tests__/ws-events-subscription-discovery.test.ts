import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { discoverSessions, buildProjectDetail } from "../../command-center/discovery.ts";
import {
  handleWsEventsConnection,
  _setResourceObservationOverrideForTests,
  _setFleetFactsReadersForTests,
  _stopFleetFactsObserverForTests,
  _detachProjectRegistryListenerForTests,
  _resetResourceEventJournalForTests,
} from "../../command-center/ws-events.ts";

vi.mock("../../command-center/discovery.ts", () => ({
  discoverSessions: vi.fn(() => [{ name: "alpha" }]),
  buildOverviews: vi.fn(() => []),
  buildProjectDetail: vi.fn(() => ({ name: "alpha", marker: "legacy-snapshot" })),
}));
const identity = {
  protocolVersion: 1,
  productVersion: "2.8.0",
  instanceId: "9bcf33b0-c837-4a94-b5e8-c0977f54464f",
  startedAt: "2026-07-21T00:00:00.000Z",
} as const;
class Socket extends EventEmitter {
  readyState = 1;
  sent: string[] = [];
  send(data: string) {
    this.sent.push(data);
  }
  receive(value: unknown) {
    this.emit("message", JSON.stringify(value), false);
  }
  disconnect() {
    this.readyState = 3;
    this.emit("close");
  }
}
afterEach(() => {
  _setResourceObservationOverrideForTests(null);
  _setFleetFactsReadersForTests(null);
  _stopFleetFactsObserverForTests();
  _detachProjectRegistryListenerForTests();
  _resetResourceEventJournalForTests();
  vi.clearAllMocks();
});
it("semantic multi-session subscription acknowledges interests without legacy discovery", async () => {
  const release = vi.fn();
  const acquire = vi.fn(() => ({
    release,
    ready: Promise.resolve({ status: "installed" as const }),
  }));
  _setResourceObservationOverrideForTests(acquire);
  const socket = new Socket();
  handleWsEventsConnection(socket, identity, { mode: "semantic" });
  try {
    socket.receive({
      type: "subscribe",
      sessions: Array.from({ length: 32 }, (_, i) => `session-${i}`),
      legacyEvents: false,
      interestRevision: 1,
      interests: [{ resource: "workspace-files", workspaceName: "alpha" }],
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(discoverSessions).not.toHaveBeenCalled();
    expect(buildProjectDetail).not.toHaveBeenCalled();
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(socket.sent.map((value) => JSON.parse(value))).toContainEqual({
      type: "resource.interests-ack",
      interestRevision: 1,
      sequence: 0,
      unavailableInterests: [],
    });
  } finally {
    socket.disconnect();
  }
  expect(release).toHaveBeenCalledTimes(1);
});
it("legacy initial subscription still discovers and publishes its live snapshot", () => {
  _setFleetFactsReadersForTests({
    readSessions: async () => ({ sessions: [], adopted: [] }),
    readAgents: async () => new Map(),
  });
  const socket = new Socket();
  handleWsEventsConnection(socket, identity);
  vi.clearAllMocks();
  socket.sent = [];
  try {
    socket.receive({ type: "subscribe", sessions: ["alpha"] });
    expect(discoverSessions).toHaveBeenCalled();
    expect(buildProjectDetail).toHaveBeenCalledTimes(1);
    expect(socket.sent.map((value) => JSON.parse(value))).toContainEqual({
      type: "snapshot",
      sessionName: "alpha",
      data: { project: { name: "alpha", marker: "legacy-snapshot" } },
    });
    socket.sent = [];
    socket.receive({ type: "subscribe", sessions: ["missing"] });
    expect(
      socket.sent.map((value) => JSON.parse(value)).filter((frame) => frame.type === "snapshot"),
    ).toEqual([]);
    expect(buildProjectDetail).toHaveBeenCalledTimes(1);
  } finally {
    socket.disconnect();
  }
});
