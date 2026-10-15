/** TUI telemetry adapter; transport ownership is shared with native clients. */
import {
  createDaemonConnectionOwner,
  type DaemonConnectionOwnerDependencies,
} from "../../../lib/daemon-connection-owner.ts";
import { tuiPerfMark } from "./application-performance-log.ts";
export type {
  DaemonConnectionEndpoint as ApplicationDaemonEndpoint,
  DaemonConnectionOwnerDependencies as ApplicationDaemonAuthorityDependencies,
} from "../../../lib/daemon-connection-owner.ts";
export function createApplicationDaemonAuthority(dependencies?: DaemonConnectionOwnerDependencies) {
  return createDaemonConnectionOwner(dependencies, (status) => {
    tuiPerfMark("machine-connection-status", { ...status });
  });
}
