import { z } from "zod";
import { TerminalAttachmentSemanticPaneIdSchemaZ } from "./semantic-identity.ts";
import { TmuxServerGenerationSchemaZ, TmuxServerScopeSchemaZ } from "./owner-scope-identity.ts";
import { WorkspaceCatalogLiveSessionIdSchemaZ } from "./workspace-catalog-resource.ts";
import { WorkspaceIdSchemaZ, WorkspacePaneCwdSchemaZ } from "./workspace-state.ts";

export const PaneEditorContextTargetSchemaZ = z
  .object({
    generation: TmuxServerGenerationSchemaZ,
    workspaceName: WorkspaceIdSchemaZ,
    liveSessionId: WorkspaceCatalogLiveSessionIdSchemaZ,
    semanticPaneId: TerminalAttachmentSemanticPaneIdSchemaZ,
  })
  .strict();
export type PaneEditorContextTarget = z.infer<typeof PaneEditorContextTargetSchemaZ>;

// Host-neutral absolute filesystem syntax, not a URI or a drive-relative path.
// The daemon resolves on its own host; clients never reinterpret separators.
const DirectorySchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (value) => !value.includes("\0") && /^(?:\/|[A-Za-z]:[/\\]|\\\\[^\\]+\\[^\\]+)/u.test(value),
    "Expected an absolute filesystem directory",
  );

/** A fresh directory observation, not permission to launch a program later. */
export const PaneEditorContextObservationSchemaZ = PaneEditorContextTargetSchemaZ.extend({
  cwd: WorkspacePaneCwdSchemaZ,
  directory: DirectorySchema,
})
  .strict()
  .refine(
    (value) => value.cwd.kind !== "absolute" || value.cwd.path === value.directory,
    "Absolute cwd must match the observed directory",
  );
export type PaneEditorContextObservation = z.infer<typeof PaneEditorContextObservationSchemaZ>;

export const PaneEditorContextResponseSchemaZ = z
  .object({
    version: z.literal(1),
    server: TmuxServerScopeSchemaZ,
    context: PaneEditorContextObservationSchemaZ,
  })
  .strict()
  .refine(
    (value) => value.context.generation === value.server.generation,
    "Context must belong to the response generation",
  );
export type PaneEditorContextResponse = z.infer<typeof PaneEditorContextResponseSchemaZ>;
