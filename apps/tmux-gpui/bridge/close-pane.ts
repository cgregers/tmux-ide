import { randomUUID } from "node:crypto";
import { WorkspacePaneKillResultSchemaZ } from "../../../packages/contracts/src/workspace-multiplexer.ts";
import type { PaneStreamRuntimeClient } from "../../../packages/daemon-client/src/pane-stream-client.ts";
import type { NewWindowTarget } from "./new-window.ts";
/** Authorization preparation only; deletion is dispatched by the surviving browser owner. */
export function createClosePanePreflight() {
  let consumed: string | null = null;
  return async (
    runtime: Pick<PaneStreamRuntimeClient, "ownsConnectionAuthority" | "requestAuthority">,
    current: () => NewWindowTarget | null,
  ) => {
    const captured = current();
    if (!captured || consumed === captured.token || !runtime.ownsConnectionAuthority("input"))
      return null;
    const target = { ...captured };
    consumed = target.token;
    if (
      !runtime.ownsConnectionAuthority("geometry") &&
      !(await runtime.requestAuthority("geometry"))
    )
      return null;
    const now = current();
    return now &&
      Object.entries(target).every(([key, value]) => now[key as keyof NewWindowTarget] === value) &&
      runtime.ownsConnectionAuthority("input") &&
      runtime.ownsConnectionAuthority("geometry")
      ? target
      : null;
  };
}
/** Exactly one owner call. A killed target cannot be required to retain its old live frame. */
export async function closePane(options: {
  current: () => boolean;
  generation: string;
  workspace: string;
  pane: string;
  submit: (operationId: string) => Promise<unknown>;
}) {
  if (!options.current()) return false;
  const operationId = randomUUID();
  const parsed = WorkspacePaneKillResultSchemaZ.safeParse(await options.submit(operationId));
  if (!options.current()) return false;
  if (
    !parsed.success ||
    parsed.data.operationId !== operationId ||
    parsed.data.daemonInstanceId !== options.generation ||
    parsed.data.workspaceName !== options.workspace ||
    parsed.data.outcome !== "applied"
  )
    throw new Error("Pane close not confirmed");
  return true;
}
export function confirmsClosedPane(ids: readonly string[], killed: string) {
  return ids.length <= 512 && !ids.includes(killed) && new Set(ids).size === ids.length;
}
