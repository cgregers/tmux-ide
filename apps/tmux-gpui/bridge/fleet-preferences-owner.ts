import { LOCAL_MACHINE_ID } from "../../../packages/contracts/src/saved-machines.ts";
import type { MachineConnectionHandle } from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import { canonicalDaemonUrl } from "../../../packages/daemon/src/lib/canonical-daemon.ts";
import { hostSchema } from "./config.ts";
import type { VerifiedLocalFleetPreferenceOwner } from "./fleet-preferences.ts";

/** Bind only the fleet manager's verified local handle, independent of selected SSH. */
export function createLocalFleetPreferenceOwner(
  manager: { getMachine(id: string): MachineConnectionHandle | null },
  request: typeof fetch = fetch,
) {
  let cached: VerifiedLocalFleetPreferenceOwner | null = null;
  return (): VerifiedLocalFleetPreferenceOwner | null => {
    if (cached) {
      try {
        cached.assertCurrent();
        return cached;
      } catch {
        cached = null;
      }
    }
    const handle = manager.getMachine(LOCAL_MACHINE_ID);
    if (!handle || handle.kind !== "local") return null;
    const endpoint = handle.endpoint();
    const info = handle.read();
    if (endpoint.kind !== "local" || endpoint.state !== "ready" || !info?.authToken) return null;
    const identity = JSON.stringify(info);
    const epoch = endpoint.epoch;
    const base = hostSchema.shape.baseUrl.safeParse(
      canonicalDaemonUrl("http", info.bindHostname, info.port, "/"),
    );
    if (!base.success) return null;
    const assertCurrent = () => {
      const current = handle.endpoint();
      if (
        manager.getMachine(LOCAL_MACHINE_ID) !== handle ||
        handle.kind !== "local" ||
        current.kind !== "local" ||
        current.state !== "ready" ||
        current.epoch !== epoch ||
        JSON.stringify(handle.read()) !== identity
      )
        throw new Error("Local fleet preference owner changed. Refresh preferences.");
    };
    // Copy private values; a mutable discovery object cannot redirect an existing owner.
    const token = info.authToken;
    const url = new URL("/api/resources/fleet-client-state", base.data);
    cached = {
      kind: "local",
      instanceId: info.instanceId,
      startedAt: info.startedAt,
      assertCurrent,
      async request(input) {
        const { method, body, signal } = input;
        signal.throwIfAborted();
        assertCurrent();
        const response = await request(url, {
          method,
          body,
          signal,
          redirect: "error",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
        });
        try {
          signal.throwIfAborted();
          assertCurrent();
          return response;
        } catch (error) {
          await response.body?.cancel().catch(() => {});
          throw error;
        }
      },
    };
    return cached;
  };
}
