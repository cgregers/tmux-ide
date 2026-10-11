import { createFleetConnectionOwner } from "./fleet-local-owner.ts";
import { createMachineConnectionManager } from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import type { SavedMachine } from "../../../packages/contracts/src/saved-machines.ts";
import { createNativeFleet, FleetSelectionError } from "./fleet.ts";
import { discoverPreviewHost, localPreviewHostProof } from "./discovery.ts";
import { createRemotePreviewRoute, type RemotePreviewRoute } from "./remote-route.ts";
import type { PreviewHost } from "./config.ts";

/** Production-local fleet composition. Private host-file previews never instantiate this. */
export function createNativeFleetRuntime(changed: () => void, retired: () => void) {
  const manager = createMachineConnectionManager({ createOwner: createFleetConnectionOwner });
  let selected: ReturnType<ReturnType<typeof createNativeFleet>["select"]> | null = null;
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
        selected.assertCurrent();
      } catch {
        invalidate();
      }
    }
    changed();
  });
  return {
    start: () => fleet.start(),
    publication: fleet.publication,
    observeAgents: fleet.observeAgents,
    resolveAgent: fleet.resolveAgent,
    retry: fleet.retry,
    disconnect: fleet.disconnect,
    reconcile: (profiles: readonly SavedMachine[]) => manager.reconcile(profiles),
    clearSelection: clear,
    async select(token: string) {
      clear();
      const selection = fleet.select(token);
      selected = selection;
      const signal = attempt.signal;
      const check = () => {
        if (stopped || selected !== selection || signal.aborted) throw new FleetSelectionError();
        selection.assertCurrent();
      };
      try {
        let discovered: PreviewHost;
        if (selection.handle.kind === "local") {
          discovered = await discoverPreviewHost(undefined, undefined, selection.session.server);
        } else {
          const route = await createRemotePreviewRoute(
            {
              endpoint: selection.handle.endpoint,
              observe: selection.handle.observe,
              observeConnection: manager.subscribe,
            },
            { signal, scope: selection.session.server },
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
        return { host, sessionId: selection.session.liveSessionId!, session: selection.session };
      } catch (error) {
        if (selected === selection) clear();
        throw error;
      }
    },
    async read() {
      const selection = selected;
      const captured = host;
      if (!selection || !captured) throw new FleetSelectionError();
      selection.assertCurrent();
      if (remote) await remote.verify();
      else await localPreviewHostProof(captured)?.verify(attempt.signal);
      if (selected !== selection) throw new FleetSelectionError();
      selection.assertCurrent();
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
