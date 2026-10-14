import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  WorkspacePaneCreateMutationResultSchemaZ,
  WorkspacePaneDisplayTitleSchemaZ,
} from "../../../packages/contracts/src/workspace-pane-creation.ts";
import type { createTmuxServerClient } from "../../../packages/daemon-client/src/tmux-server-client.ts";
import type { PaneStreamRuntimeClient } from "../../../packages/daemon-client/src/pane-stream-client.ts";
import type { PaneActionTarget } from "./pane-actions.ts";
import type { Layout } from "./topology.ts";
export const newAgentSchema = z
  .object({
    name: WorkspacePaneDisplayTitleSchemaZ,
    harness: z.enum(["claude", "codex"]),
  })
  .strict();
export type NewAgent = z.infer<typeof newAgentSchema>;
export function matchesCreation(
  resource: z.infer<typeof WorkspacePaneCreateMutationResultSchemaZ>["resource"],
  agent?: NewAgent,
) {
  return agent
    ? resource.kind === "agent" &&
        resource.displayTitle === agent.name &&
        resource.harnessProfileId === agent.harness &&
        resource.role === "implementer" &&
        resource.missionId === null
    : resource.kind === "terminal";
}
export const newWindowReceiptSchema = WorkspacePaneCreateMutationResultSchemaZ;
export type NewWindowTarget = PaneActionTarget & { session: string; presenceRevision: number };
/** Scoped owner action, never a multiplexer intent or an unscoped/default-server request. */
export function createNewWindowExecutor() {
  let consumed: string | null = null;
  return async (
    client: Pick<ReturnType<typeof createTmuxServerClient>, "createPane">,
    runtime: Pick<PaneStreamRuntimeClient, "ownsConnectionAuthority" | "requestAuthority">,
    current: () => NewWindowTarget | null,
    agentInput?: NewAgent,
  ) => {
    const agent = agentInput === undefined ? undefined : newAgentSchema.parse(agentInput);
    const captured = current();
    if (!captured || consumed === captured.token || !runtime.ownsConnectionAuthority("input"))
      return null;
    const target = { ...captured };
    consumed = target.token;
    const same = (token: boolean) => {
      const now = current();
      return (
        !!now &&
        Object.entries(target).every(
          ([key, value]) =>
            (!token && key === "token") || now[key as keyof NewWindowTarget] === value,
        )
      );
    };
    if (
      !runtime.ownsConnectionAuthority("geometry") &&
      !(await runtime.requestAuthority("geometry"))
    )
      return null;
    if (
      !same(true) ||
      !runtime.ownsConnectionAuthority("input") ||
      !runtime.ownsConnectionAuthority("geometry")
    )
      return null;
    const operationId = randomUUID();
    const raw = await client.createPane(
      operationId,
      {
        workspaceName: target.workspace,
        ...(agent
          ? {
              kind: "agent" as const,
              displayTitle: agent.name,
              harnessProfileId: agent.harness,
              role: "implementer" as const,
            }
          : { kind: "terminal" as const }),
        placement: { kind: "window" },
      },
      target.session,
    );
    const parsed = newWindowReceiptSchema.safeParse(raw);
    if (
      !same(false) ||
      !runtime.ownsConnectionAuthority("input") ||
      !runtime.ownsConnectionAuthority("geometry") ||
      !parsed.success
    )
      return null;
    const result = parsed.data;
    return result.operationId === operationId &&
      result.daemonInstanceId === target.generation &&
      result.outcome === "created" &&
      result.resource.workspaceName === target.workspace &&
      matchesCreation(result.resource, agent) &&
      result.resource.semanticPaneId !== target.id
      ? result
      : null;
  };
}
/** Receipt alone cannot assert which window was created: require current canonical topology. */
export function confirmsNewWindow(
  layouts: Layout[],
  originalPane: string,
  oldWindow: string,
  createdPane: string,
) {
  const original = layouts.filter((l) => l.panes.some((p) => p.pane === originalPane));
  const created = layouts.filter((l) => l.panes.some((p) => p.pane === createdPane));
  return (
    original.length === 1 &&
    original[0].semanticWindowId === oldWindow &&
    created.length === 1 &&
    !!created[0].semanticWindowId &&
    created[0].semanticWindowId !== oldWindow
  );
}
