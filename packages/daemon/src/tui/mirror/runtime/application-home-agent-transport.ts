/** The TUI supplies its selected-machine reader; shared transport has no singleton. */
import { readApplicationDaemonInfo } from "./application-daemon-authority.ts";
import { createHomeAgentTransport } from "../../../lib/home-agent-transport.ts";
export {
  sameHomeAgentDaemon,
  type HomeAgentEventSocket,
} from "../../../lib/home-agent-transport.ts";
export function createApplicationHomeAgentTransport(
  options: Partial<Parameters<typeof createHomeAgentTransport>[0]> = {},
) {
  return createHomeAgentTransport({
    ...options,
    readDaemon: options.readDaemon ?? readApplicationDaemonInfo,
  });
}
export const applicationHomeAgentTransport = createApplicationHomeAgentTransport();
