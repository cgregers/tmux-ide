import { createSharedAgentObservation } from "./shared-agent-observation.ts";
import { createMachineAgents } from "../../../packages/daemon/src/lib/machine-agents.ts";
import { createFleetAgentRoster } from "./fleet-agents.ts";
import type { HomeAgentSnapshot } from "../../../packages/presentation/src/home-agent-roster.ts";
import { randomUUID } from "node:crypto";
import type {
  MachineConnectionHandle,
  MachineConnectionManager,
} from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import {
  createMachineCatalog,
  type MachineCatalogSession,
} from "../../../packages/daemon/src/lib/machine-catalog.ts";

type Catalog = ReturnType<typeof createMachineCatalog>;
export interface NativeFleetPublication {
  groups: {
    id: string;
    label: string;
    state: "ready" | "connecting" | "disconnected";
    conflict: boolean;
    retry: string | null;
    disconnect: string | null;
    omittedSessions: number;
    sessions: {
      id: string;
      name: string;
      paneCount: number;
      sessionId: string | null;
      selection: string | null;
    }[];
  }[];
  omittedGroups: number;
}
interface Route {
  handle: MachineConnectionHandle;
  epoch: number;
  instance: string;
  session: MachineCatalogSession;
  key: string;
}

/** A stale displayed row must never resolve against a replacement daemon or SSH route. */
export class FleetSelectionError extends Error {
  constructor() {
    super("Machine or session changed. Refresh the fleet and select the session again.");
    this.name = "FleetSelectionError";
  }
}

/**
 * Metadata-only native projection over the TUI's shared fleet owner. The caller
 * supplies the manager explicitly so a private demo cannot discover a personal
 * daemon by accident. This owner disposes its catalog, never the borrowed manager.
 */
export function createNativeFleet(
  manager: MachineConnectionManager,
  changed: () => void,
  makeCatalog: (manager: MachineConnectionManager) => Catalog = (manager) =>
    createMachineCatalog({ manager }),
) {
  const catalog = makeCatalog(manager);
  let agentRoster: ReturnType<typeof createFleetAgentRoster> | undefined;
  let stopped = false;
  let started = false;
  let selectionRevision = 0;
  let stop = () => {};
  let routes = new Map<string, Route>();
  let retries = new Map<string, { handle: MachineConnectionHandle; epoch: number }>();
  let disconnects = new Map<string, { handle: MachineConnectionHandle; epoch: number }>();
  const canDisconnect = (entry: { handle: MachineConnectionHandle; epoch: number }) =>
    !stopped &&
    manager.getMachine(entry.handle.id) === entry.handle &&
    entry.handle.kind === "ssh" &&
    entry.handle.endpoint().state !== "disconnected" &&
    entry.handle.endpoint().epoch === entry.epoch;
  const canRetry = (entry: { handle: MachineConnectionHandle; epoch: number }) =>
    !stopped &&
    manager.getMachine(entry.handle.id) === entry.handle &&
    entry.handle.kind === "ssh" &&
    entry.handle.endpoint().state === "disconnected" &&
    entry.handle.endpoint().epoch === entry.epoch;
  let publication: NativeFleetPublication = { groups: [], omittedGroups: 0 };
  const current = (route: Route) => {
    const info = route.handle.read();
    return (
      !stopped &&
      manager.getMachine(route.handle.id) === route.handle &&
      route.handle.endpoint().state === "ready" &&
      route.handle.endpoint().epoch === route.epoch &&
      !!info &&
      JSON.stringify([info.instanceId, info.startedAt]) === route.instance
    );
  };
  const update = () => {
    if (stopped) return;
    const snapshot = catalog.getSnapshot();
    const previous = new Map([...routes].map(([token, route]) => [route.key, { token, route }]));
    const next = new Map<string, Route>();
    const nextRetries = new Map<string, { handle: MachineConnectionHandle; epoch: number }>();
    const nextDisconnects = new Map<string, { handle: MachineConnectionHandle; epoch: number }>();
    let remaining = 512;
    publication = {
      omittedGroups: Math.max(0, snapshot.groups.length - 64),
      groups: snapshot.groups.slice(0, 64).map((group) => {
        const visible = group.sessions.slice(0, Math.min(128, remaining));
        remaining -= visible.length;
        const handle = manager.getMachine(group.id);
        let retry: string | null = null;
        if (handle && group.state === "disconnected" && !group.identityConflict) {
          const entry = { handle, epoch: handle.endpoint().epoch };
          if (canRetry(entry)) {
            retry =
              [...retries].find(([, old]) => old.handle === handle && canRetry(old))?.[0] ??
              randomUUID();
            nextRetries.set(retry, entry);
          }
        }
        let disconnect: string | null = null;
        if (handle) {
          const entry = { handle, epoch: handle.endpoint().epoch };
          if (canDisconnect(entry)) {
            disconnect =
              [...disconnects].find(
                ([, old]) => old.handle === handle && canDisconnect(old),
              )?.[0] ?? randomUUID();
            nextDisconnects.set(disconnect, entry);
          }
        }
        return {
          id: group.id,
          disconnect,
          retry,
          label: group.label.slice(0, 256),
          state: group.state,
          conflict: !!group.identityConflict,
          omittedSessions: Math.max(0, group.sessions.length - visible.length),
          sessions: visible.map((session) => {
            let selection: string | null = null;
            const handle = manager.getMachine(session.machineId);
            const info = handle?.read();
            if (
              group.state === "ready" &&
              !group.identityConflict &&
              !session.disabled &&
              handle &&
              info &&
              session.server &&
              session.liveSessionId
            ) {
              const route: Route = {
                handle,
                epoch: handle.endpoint().epoch,
                instance: JSON.stringify([info.instanceId, info.startedAt]),
                session: structuredClone(session),
                key: JSON.stringify([
                  handle.id,
                  session.sourceId,
                  session.server,
                  session.liveSessionId,
                ]),
              };
              if (current(route)) {
                const prior = previous.get(route.key);
                selection = prior && current(prior.route) ? prior.token : randomUUID();
                next.set(selection, route);
              }
            }
            return {
              id: session.id,
              name: session.name.slice(0, 512),
              paneCount: session.paneCount,
              sessionId: session.liveSessionId ?? null,
              selection,
            };
          }),
        };
      }),
    };
    routes = next;
    retries = nextRetries;
    disconnects = nextDisconnects;
    agentRoster?.refresh();
    changed();
  };
  const observation = createSharedAgentObservation((publish) => {
    const roster = createFleetAgentRoster(
      createMachineAgents({ catalog, manager }),
      (machineId, row) =>
        [...routes].find(
          ([, route]) =>
            route.handle.id === machineId &&
            current(route) &&
            route.session.sourceId === row.sessionKey &&
            route.session.liveSessionId === row.liveSessionId &&
            route.session.server?.serverId === row.server?.serverId &&
            route.session.server?.generation === row.server?.generation,
        )?.[0] ?? null,
      (id) => catalog.getSnapshot().groups.find((group) => group.id === id)?.label ?? "Machine",
      publish,
      (id) =>
        catalog.getSnapshot().groups.find((group) => group.id === id)?.state ?? "disconnected",
    );
    agentRoster = roster;
    roster.start();
    return () => {
      if (agentRoster === roster) agentRoster = undefined;
      roster.dispose();
    };
  });
  return {
    start() {
      if (stopped || started) return;
      started = true;
      stop = catalog.subscribe(update);
      catalog.start();
    },
    observeAgents: observation.subscribe,
    resolveAgent: (key: string) => agentRoster?.resolve(key) ?? null,
    publication: () => structuredClone(publication),
    select(token: string) {
      const route = routes.get(token);
      if (!route || !current(route)) throw new FleetSelectionError();
      if (!manager.select(route.handle.id)) throw new FleetSelectionError();
      const selectedEpoch = manager.endpoint().epoch;
      const revision = ++selectionRevision;
      const assertCurrent = () => {
        if (
          selectionRevision !== revision ||
          manager.endpoint().epoch !== selectedEpoch ||
          manager.snapshot().selectedMachineId !== route.handle.id ||
          routes.get(token)?.key !== route.key ||
          !current(route)
        )
          throw new FleetSelectionError();
      };
      assertCurrent();
      return { handle: route.handle, session: structuredClone(route.session), assertCurrent };
    },
    retry: (token: string) => {
      const entry = retries.get(token);
      if (!entry || !canRetry(entry)) throw new FleetSelectionError();
      retries.delete(token);
      manager.retry(entry.handle.id);
      catalog.retry(entry.handle.id);
      update();
    },
    disconnect: (token: string) => {
      const entry = disconnects.get(token);
      if (!entry || !canDisconnect(entry)) throw new FleetSelectionError();
      disconnects.delete(token);
      manager.disconnect(entry.handle.id);
      update();
    },
    dispose() {
      if (stopped) return;
      stopped = true;
      stop();
      observation.dispose();
      catalog.dispose();
      routes.clear();
      retries.clear();
      disconnects.clear();
      publication = { groups: [], omittedGroups: 0 };
    },
  };
}
