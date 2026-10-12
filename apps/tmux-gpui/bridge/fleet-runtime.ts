import { assertFleetSelectionCurrent } from "./fleet-selection-current.ts";
import { createFleetConnectionOwner } from "./fleet-local-owner.ts";
import { createMachineConnectionManager } from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import type { SavedMachine } from "../../../packages/contracts/src/saved-machines.ts";
import { createNativeFleet, FleetSelectionError } from "./fleet.ts";
import { discoverPreviewDaemon, discoverPreviewHost, localPreviewHostProof } from "./discovery.ts";
import { createRemotePreviewRoute, type RemotePreviewRoute } from "./remote-route.ts";
import type { PreviewHost } from "./config.ts";

/** Production-local fleet composition. Private host-file previews never instantiate this. */
export function createNativeFleetRuntime(changed: () => void, retired: () => void) {
  const manager = createMachineConnectionManager({ createOwner: createFleetConnectionOwner });
  type Fleet = ReturnType<typeof createNativeFleet>;
  let selected: ReturnType<Fleet["select"]> | ReturnType<Fleet["selectServer"]> | null = null;
  let host: PreviewHost | null = null;
  let remote: RemotePreviewRoute | null = null;
  let attempt = new AbortController();
  let stopped = false;
  const clear = () => {
    selected = null;
    host = null;
    attempt.abort();
    attempt = new AbortController();
    remote?.dispose();
    remote = null;
  };
  const invalidate = () => {
    if (!selected || stopped) return;
    clear();
    retired();
  };
  const fleet = createNativeFleet(manager, () => {
    if (selected) {
      try {
        assertFleetSelectionCurrent(selected, selectedServer() !== null);
      } catch {
        invalidate();
      }
    }
    changed();
  });
  const selectedServer = () => {
    if (!selected) return null;
    try {
      selected.assertCurrent();
    } catch {
      return null;
    }
    const scope = "descriptor" in selected ? selected.descriptor : selected.session.server;
    if (!scope) return null;
    const group = fleet.publication().groups.find((group) => group.id === selected!.handle.id);
    const server = group?.servers.find(
      (server) =>
        server.id === scope.serverId &&
        server.generation === scope.generation &&
        server.state === "online" &&
        server.selection,
    );
    return group && server && server.generation
      ? {
          machineId: group.id,
          machineLabel: group.label,
          serverId: server.id,
          generation: server.generation,
          label: server.label,
        }
      : null;
  };
  const connect = async (selection: NonNullable<typeof selected>) => {
    selected = selection;
    const signal = attempt.signal;
    const check = () => {
      if (stopped || selected !== selection || signal.aborted) throw new FleetSelectionError();
      selection.assertCurrent();
    };
    const scope =
      "session" in selection
        ? selection.session.server
        : {
            serverId: selection.descriptor.serverId,
            generation: selection.descriptor.generation,
          };
    try {
      let discovered: PreviewHost;
      if (selection.handle.kind === "local") {
        if ("descriptor" in selection) {
          const observed = await discoverPreviewDaemon();
          check();
          const expected = selection.handle.read();
          if (
            !expected ||
            expected.instanceId !== observed.instanceId ||
            expected.startedAt !== observed.startedAt ||
            expected.authToken !== observed.authToken
          )
            throw new FleetSelectionError();
        }
        discovered = await discoverPreviewHost(undefined, undefined, scope);
        if (
          "descriptor" in selection &&
          discovered.ownerToken !== selection.handle.read()?.authToken
        )
          throw new FleetSelectionError();
      } else {
        const route = await createRemotePreviewRoute(
          {
            endpoint: selection.handle.endpoint,
            observe: selection.handle.observe,
            observeConnection: manager.subscribe,
          },
          { signal, scope },
        );
        try {
          check();
        } catch (error) {
          route.dispose();
          throw error;
        }
        remote = route;
        route.signal.addEventListener("abort", invalidate, { once: true });
        discovered = route.host;
      }
      check();
      host = discovered;
      return discovered;
    } catch (error) {
      if (selected === selection) clear();
      throw error;
    }
  };
  return {
    start: () => fleet.start(),
    publication: fleet.publication,
    observeAgents: fleet.observeAgents,
    observeHomeAgents: fleet.observeHomeAgents,
    filterHomeAgents: fleet.filterHomeAgents,
    recoverAgents: fleet.recoverAgents,
    resolveAgent: fleet.resolveAgent,
    retry: fleet.retry,
    disconnect: fleet.disconnect,
    reconcile: (profiles: readonly SavedMachine[]) => manager.reconcile(profiles),
    clearSelection: clear,
    async select(token: string) {
      clear();
      const selection = fleet.select(token);
      const host = await connect(selection);
      return { host, sessionId: selection.session.liveSessionId!, session: selection.session };
    },
    async selectServer(token: string) {
      clear();
      const selection = fleet.selectServer(token);
      return { host: await connect(selection), descriptor: selection.descriptor };
    },
    selectedServer,
    assertCurrent() {
      if (!selected || !host) throw new FleetSelectionError();
      assertFleetSelectionCurrent(selected, selectedServer() !== null, true);
    },
    async read() {
      const selection = selected;
      const captured = host;
      const signal = attempt.signal;
      if (!selection || !captured) throw new FleetSelectionError();
      const check = () => {
        if (stopped || selected !== selection || signal.aborted) throw new FleetSelectionError();
        try {
          selection.assertCurrent();
        } catch {
          // Server-route guards expose no public error type or private details.
          throw new FleetSelectionError();
        }
      };
      check();
      try {
        if (remote) await remote.verify();
        else await localPreviewHostProof(captured)?.verify(signal);
      } catch (error) {
        // Retirement can abort verification before its normal post-await fence.
        // Only our captured route lifetime qualifies this fixed guidance.
        check();
        localPreviewHostProof(captured)?.assertCurrent();
        throw error;
      }
      check();
      return captured;
    },
    dispose() {
      if (stopped) return;
      stopped = true;
      clear();
      fleet.dispose();
      manager.dispose();
    },
  };
}
