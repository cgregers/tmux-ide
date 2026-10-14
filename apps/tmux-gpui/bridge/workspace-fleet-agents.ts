import { z } from "zod";
import { sameAgentTarget } from "./fleet-agents.ts";
import { paneTeamGroupKey } from "../../../packages/contracts/src/pane-team.ts";
import type {
  HomeAgentRow,
  HomeAgentSnapshot,
} from "../../../packages/presentation/src/home-agent-roster.ts";
import { homeAgentPublication, openAgentSchema } from "./home-agent-publication.ts";
import { discoveredAgentRequest } from "./fleet-agent-admission.ts";
export const openWorkspaceFleetAgentSchema = openAgentSchema.extend({
  type: z.literal("open-workspace-fleet-agent"),
  scope: z.number().int().positive().safe(),
});
type Fleet = Pick<
  ReturnType<typeof import("./fleet-runtime.ts").createNativeFleetRuntime>,
  "observeWorkspaceAgents" | "resolveAgent"
>;
/** Same membership grouping as the TUI, without importing its renderer. Names are not group identities. */
export function workspaceAgentRows(rows: readonly HomeAgentRow[]) {
  const machines = new Map<string, HomeAgentRow[]>();
  for (const row of rows) {
    const id = row.machineId ?? "local";
    const group = machines.get(id) ?? [];
    group.push(row);
    machines.set(id, group);
  }
  return [...machines.values()].flatMap((rows) => {
    const teams = new Map<string, HomeAgentRow[]>(),
      ungrouped: HomeAgentRow[] = [];
    for (const row of rows) {
      if (!row.team) {
        ungrouped.push(row);
        continue;
      }
      const key = paneTeamGroupKey(
        row.team,
        row.machineId ?? "local",
        row.server?.serverId ?? "default",
        row.server?.generation ?? row.daemonInstanceId,
      );
      const group = teams.get(key) ?? [];
      group.push(row);
      teams.set(key, group);
    }
    return [...teams.values()].flat().concat(ungrouped);
  });
}
export function createWorkspaceFleetAgents(changed: () => void) {
  let scope = 0,
    revision = 0;
  let active: { request: number; scope: number; route: object; fleet: Fleet } | null = null;
  let stop: (() => void) | undefined;
  let rows: readonly HomeAgentRow[] = [];
  let selected: (row: HomeAgentRow) => boolean = () => false;
  let publication:
    | (ReturnType<typeof homeAgentPublication> & { request: number; scope: number })
    | null = null;
  const cancel = () => {
    active = null;
    publication = null;
    rows = [];
    const old = stop;
    stop = undefined;
    old?.();
  };
  return {
    cancel,
    sync(
      request: number,
      route: object | null,
      enabled: boolean,
      fleet: Fleet | undefined,
      isSelected: (row: HomeAgentRow) => boolean,
    ) {
      selected = isSelected;
      if (!enabled || !route || !fleet) {
        cancel();
        return;
      }
      if (active?.request === request && active.route === route && active.fleet === fleet) return;
      cancel();
      if (scope === Number.MAX_SAFE_INTEGER) return;
      const lifetime = { request, scope: ++scope, route, fleet };
      active = lifetime;
      const publish = (snapshot: HomeAgentSnapshot) => {
        if (active !== lifetime || revision === Number.MAX_SAFE_INTEGER) return;
        rows = workspaceAgentRows(snapshot.rows);
        publication = {
          ...homeAgentPublication(
            { ...snapshot, rows },
            ++revision,
            (row) => !!discoveredAgentRequest(fleet.resolveAgent(row.key)?.row),
          ),
          request,
          scope: lifetime.scope,
        };
        changed();
      };
      publish({
        phase: "loading",
        rows: [],
        observedSessions: 0,
        totalSessions: 0,
        loadingSessions: 0,
        unavailableSessions: 0,
        truncatedSessions: 0,
        refreshingSessionKeys: [],
        unavailableSessionKeys: [],
        note: null,
      });
      if (active !== lifetime) return;
      const subscription = fleet.observeWorkspaceAgents(publish);
      if (active === lifetime) stop = subscription;
      else subscription();
    },
    publication() {
      if (!publication) return null;
      const candidates = publication.rows.filter((row) => {
        const current = active?.fleet.resolveAgent(row.key);
        return (
          row.available &&
          !!current &&
          rows.some(
            (source) =>
              source.key === row.key &&
              source.machineId === current.machineId &&
              sameAgentTarget(source, current.row) &&
              selected(source),
          )
        );
      });
      return { ...publication, selectedKey: candidates.length === 1 ? candidates[0]!.key : null };
    },
    resolve(
      command: z.infer<typeof openWorkspaceFleetAgentSchema>,
      request: number,
      foreground: boolean,
      fleet: Fleet | undefined,
    ) {
      if (
        !foreground ||
        command.fromRequest !== request ||
        command.request <= request ||
        active?.request !== request ||
        active.fleet !== fleet ||
        active.scope !== command.scope ||
        publication?.revision !== command.rosterRevision ||
        (publication.phase !== "live" && publication.phase !== "partial") ||
        !publication.rows.some((row) => row.key === command.key && row.available)
      )
        return null;
      return fleet?.resolveAgent(command.key) ?? null;
    },
  };
}
