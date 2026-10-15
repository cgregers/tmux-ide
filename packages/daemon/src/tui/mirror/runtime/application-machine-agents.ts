/** TUI composition retains its application-owned connection manager. */
import { createMachineAgents } from "../../../lib/machine-agents.ts";
import { applicationMachineAuthorityManager } from "./application-machine-authority.ts";
export type {
  MachineAgent as ApplicationMachineAgent,
  MachineAgentGroup as ApplicationMachineAgentGroup,
} from "../../../lib/machine-agents.ts";
type Options = Parameters<typeof createMachineAgents>[0];
export function createApplicationMachineAgents(
  options: Omit<Options, "manager"> & { manager?: Options["manager"] },
) {
  return createMachineAgents({
    ...options,
    manager: options.manager ?? applicationMachineAuthorityManager,
  });
}
