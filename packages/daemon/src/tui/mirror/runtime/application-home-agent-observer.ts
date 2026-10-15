/** TUI adapter keeps selected-machine discovery; observation is renderer-neutral. */
import {
  createHomeAgentObserver,
  type HomeAgentDependencies,
} from "../../../lib/home-agent-observer.ts";
import { applicationHomeAgentTransport } from "./application-home-agent-transport.ts";
export type {
  HomeAgentDependencies as ApplicationHomeAgentDependencies,
  HomeAgentObserver as ApplicationHomeAgentObserver,
  HomeAgentObservationHandlers,
} from "../../../lib/home-agent-observer.ts";
export function createApplicationHomeAgentObserver(overrides: Partial<HomeAgentDependencies> = {}) {
  return createHomeAgentObserver({ ...applicationHomeAgentTransport, ...overrides });
}
