import { randomUUID } from "node:crypto";
import type { TmuxServerDescriptor } from "../../../packages/contracts/src/tmux-server-scope.ts";
import type {
  MachineConnectionHandle,
  MachineConnectionManager,
} from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import type { NativeFleetServer, NativeSelectedServer } from "./fleet-server-publication.ts";

interface Route {
  handle: MachineConnectionHandle;
  epoch: number;
  instance: string;
  descriptor: NativeSelectedServer;
}
/** Opaque server routes are independent of session availability, never a default-server guess. */
export function createFleetServerRoutes(manager: MachineConnectionManager) {
  let routes = new Map<string, Route>();
  let next = new Map<string, Route>();
  let remaining = 128;
  const current = (route: Route) => {
    const info = route.handle.read();
    return (
      manager.getMachine(route.handle.id) === route.handle &&
      route.handle.endpoint().state === "ready" &&
      route.handle.endpoint().epoch === route.epoch &&
      !!info &&
      JSON.stringify([info.instanceId, info.startedAt]) === route.instance
    );
  };
  return {
    begin() {
      next = new Map();
      remaining = 128;
    },
    project(
      machineId: string,
      machineLabel: string,
      enabled: boolean,
      servers: readonly TmuxServerDescriptor[] = [],
    ) {
      const visible = servers.slice(0, Math.min(32, remaining));
      remaining -= visible.length;
      const handle = manager.getMachine(machineId);
      const info = handle?.read();
      const rows: NativeFleetServer[] = visible.map((server) => {
        let selection: string | null = null;
        if (
          enabled &&
          handle &&
          info &&
          server.state === "online" &&
          servers.filter((candidate) => candidate.serverId === server.serverId).length === 1
        ) {
          const route: Route = {
            handle,
            epoch: handle.endpoint().epoch,
            instance: JSON.stringify([info.instanceId, info.startedAt]),
            descriptor: {
              machineId,
              machineLabel,
              serverId: server.serverId,
              generation: server.generation,
              label: server.label,
            },
          };
          if (current(route)) {
            selection =
              [...routes].find(
                ([, old]) =>
                  current(old) &&
                  old.handle === handle &&
                  old.epoch === route.epoch &&
                  old.instance === route.instance &&
                  old.descriptor.serverId === server.serverId &&
                  old.descriptor.generation === server.generation,
              )?.[0] ?? randomUUID();
            next.set(selection, route);
          }
        }
        return {
          id: server.serverId,
          label: server.label,
          state: server.state,
          generation: server.generation,
          selection,
        };
      });
      return { servers: rows, omittedServers: Math.max(0, servers.length - visible.length) };
    },
    finish() {
      routes = next;
    },
    resolve(token: string) {
      const route = routes.get(token);
      if (!route || !current(route)) throw new Error("Server selection changed");
      const assertCurrent = () => {
        const latest = routes.get(token);
        if (
          !latest ||
          latest.handle !== route.handle ||
          latest.epoch !== route.epoch ||
          latest.instance !== route.instance ||
          !current(route)
        )
          throw new Error("Server selection changed");
      };
      return { handle: route.handle, descriptor: structuredClone(route.descriptor), assertCurrent };
    },
    dispose() {
      routes.clear();
      next.clear();
    },
  };
}
