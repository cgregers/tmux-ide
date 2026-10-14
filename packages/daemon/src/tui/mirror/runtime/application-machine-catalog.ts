/** TUI composition supplies its existing manager and selected-machine catalog adapter. */
import { createMachineCatalog } from "../../../lib/machine-catalog.ts";
import { applicationMachineAuthorityManager } from "./application-machine-authority.ts";
import { createApplicationHomeCatalog } from "./application-home-catalog.ts";
export type {
  MachineCatalogSession as ApplicationMachineCatalogSession,
  MachineCatalogGroup as ApplicationMachineCatalogGroup,
  MachineCatalogSnapshot as ApplicationMachineCatalogSnapshot,
} from "../../../lib/machine-catalog.ts";
export function createApplicationMachineCatalog(
  options: Partial<Parameters<typeof createMachineCatalog>[0]> = {},
) {
  return createMachineCatalog({
    ...options,
    manager: options.manager ?? applicationMachineAuthorityManager,
    createCatalog:
      options.createCatalog ??
      ((handle) => createApplicationHomeCatalog({ readCanonicalDaemonInfo: handle.read })),
  });
}
