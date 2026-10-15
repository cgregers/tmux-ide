/** TUI adapter retains telemetry and the application-owned singleton. */
import { randomUUID } from "node:crypto";
import {
  createMachineConnectionManager,
  type MachineConnectionManagerDependencies,
} from "../../../lib/machine-connection-manager.ts";
import { createApplicationDaemonAuthority } from "./application-daemon-authority-owner.ts";
export type {
  MachineConnectionHandle as ApplicationMachineAuthorityHandle,
  MachineConnectionSummary as ApplicationMachineAuthoritySummary,
  MachineConnectionSnapshot as ApplicationMachineAuthoritySnapshot,
  MachineConnectionManager as ApplicationMachineAuthorityManager,
  MachineConnectionManagerDependencies as ApplicationMachineAuthorityManagerDependencies,
} from "../../../lib/machine-connection-manager.ts";
export function createApplicationMachineAuthorityManager(
  dependencies: MachineConnectionManagerDependencies = {
    createOwner: createApplicationDaemonAuthority,
  },
) {
  return createMachineConnectionManager(dependencies);
}
export const applicationMachineAuthorityManager = createApplicationMachineAuthorityManager();
/** Compatibility entry for explicitly targeting a single alias; other machines remain independent. */
export async function initializeSelectedApplicationSshAuthority(
  alias: string,
  signal?: AbortSignal,
): Promise<void> {
  let handle = applicationMachineAuthorityManager
    .snapshot()
    .machines.find((machine) => machine.sshTarget === alias);
  if (!handle) {
    const added = applicationMachineAuthorityManager.add({
      id: randomUUID(),
      label: `SSH ${alias}`.slice(0, 80),
      sshTarget: alias,
      enabled: true,
    });
    handle = applicationMachineAuthorityManager
      .snapshot()
      .machines.find((machine) => machine.id === added.id)!;
  }
  applicationMachineAuthorityManager.select(handle.id);
  const abort = () => applicationMachineAuthorityManager.dispose();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const ready = await applicationMachineAuthorityManager.getMachine(handle.id)!.ready;
  if (!ready) throw new Error("Could not connect to SSH machine");
}
