import type { TerminalReplicaSnapshot } from "../../../packages/contracts/src/index.ts";
import type { Layout } from "./topology.ts";

// Publication is scoped to the selected pane's window, not the server's active
// window. Keep other replicas resident so later selection can use fresh state.
export function selectedWindowSurfaces(
  layouts: readonly Layout[],
  selectedPane: string | null,
  surfaces: ReadonlyMap<string, TerminalReplicaSnapshot>,
): { paneId: string; snapshot: TerminalReplicaSnapshot }[] {
  if (!selectedPane) return [];
  const matches = layouts.filter((layout) =>
    layout.panes.some((pane) => pane.pane === selectedPane),
  );
  if (matches.length !== 1 || !matches[0].semanticWindowId) return [];
  const panes = matches[0].panes.map((pane) => pane.pane);
  if (panes.some((pane) => !pane) || new Set(panes).size !== panes.length) return [];
  return panes.flatMap((paneId) => {
    const snapshot = surfaces.get(paneId!);
    return snapshot ? [{ paneId: paneId!, snapshot }] : [];
  });
}
