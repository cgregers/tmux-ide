import { z } from "zod";
import { SemanticProductIdSchemaZ } from "./pane-appearance.ts";
import { FleetAgentIdSchemaZ } from "./fleet-catalog.ts";
import { TerminalAttachmentSemanticPaneIdSchemaZ } from "./semantic-identity.ts";
import { TmuxServerScopeSchemaZ } from "./owner-scope-identity.ts";
import { WorkspaceCatalogLiveSessionIdSchemaZ } from "./workspace-catalog-resource.ts";
import { WorkspaceIdSchemaZ } from "./workspace-state.ts";

/** Observed shell identity, including a not-yet-promoted discovered pane. */
export const TmuxAgentOpenRequestSchemaZ = z
  .object({
    observedPaneId: SemanticProductIdSchemaZ,
    observedAgentId: FleetAgentIdSchemaZ,
  })
  .strict();
export type TmuxAgentOpenRequest = z.infer<typeof TmuxAgentOpenRequestSchemaZ>;

/** Admission maps the captured native pane to its now-attachable semantic identity. */
export const TmuxAgentOpenResponseSchemaZ = z
  .object({
    version: z.literal(1),
    server: TmuxServerScopeSchemaZ,
    workspaceName: WorkspaceIdSchemaZ,
    liveSessionId: WorkspaceCatalogLiveSessionIdSchemaZ,
    semanticPaneId: TerminalAttachmentSemanticPaneIdSchemaZ,
  })
  .strict();
export type TmuxAgentOpenResponse = z.infer<typeof TmuxAgentOpenResponseSchemaZ>;
