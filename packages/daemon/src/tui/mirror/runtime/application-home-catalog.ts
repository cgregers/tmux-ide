/** TUI adapter keeps selected-machine discovery; the catalog implementation is shared. */
import { createHomeCatalog, type HomeCatalogDependencies } from "../../../lib/home-catalog.ts";
import { readApplicationDaemonInfo } from "./application-daemon-authority.ts";
export type {
  HomeCatalogResourceKey as ApplicationHomeCatalogResourceKey,
  HomeCatalogResource as ApplicationHomeCatalogResource,
  HomeCatalogTarget as ApplicationHomeCatalogTarget,
  HomeCatalogFailure as ApplicationHomeCatalogFailure,
  HomeCatalogSession as ApplicationHomeCatalogSession,
  HomeCatalogSnapshot as ApplicationHomeCatalogSnapshot,
  HomeCatalog as ApplicationHomeCatalog,
  HomeCatalogDependencies as ApplicationHomeCatalogDependencies,
} from "../../../lib/home-catalog.ts";
export {
  closeHomeCatalogTransport as closeApplicationHomeCatalogTransport,
  selectedHomeCatalogIndex,
  moveHomeCatalogSelection,
} from "../../../lib/home-catalog.ts";
export function createApplicationHomeCatalog(overrides: Partial<HomeCatalogDependencies> = {}) {
  return createHomeCatalog({ readCanonicalDaemonInfo: readApplicationDaemonInfo, ...overrides });
}
