import { workspaceAgentRows } from "./workspace-fleet-agents.ts";
import { matchesPaletteQuery } from "./palette.ts";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { createMachineAgents } from "../../../packages/daemon/src/lib/machine-agents.ts";
import {
  sortHomeAgentRows,
  type HomeAgentRow,
  type HomeAgentSnapshot,
} from "../../../packages/presentation/src/home-agent-roster.ts";

type Source = ReturnType<typeof createMachineAgents>;
interface Target {
  row: HomeAgentRow;
  machineId: string;
  selection: string;
}

/** Private route table behind the existing bounded native roster wire. */
export function createFleetAgentRoster(
  source: Source,
  sessionRoute: (machineId: string, row: HomeAgentRow) => string | null,
  machineLabel: (machineId: string) => string,
  changed: (snapshot: HomeAgentSnapshot) => void,
  machineState: (id: string) => "ready" | "connecting" | "disconnected",
  homeMachine: () => string | null = () => null,
  machineSessions?: (id: string) => number,
  paletteQuery: () => string | null = () => null,
  workspaceActive: () => boolean = () => false,
) {
  let stopped = false;
  let stop = () => {};
  let targets = new Map<string, Target>();
  let keys = new Map<string, string>();
  let homeSnapshot: HomeAgentSnapshot | null = null;
  let workspaceSnapshot: HomeAgentSnapshot | null = null;
  const refresh = (notify = true) => {
    if (stopped) return;
    const groups = source.getSnapshot();
    const next = new Map<string, Target>();
    const nextKeys = new Map<string, string>();
    const rows = sortHomeAgentRows(
      groups.flatMap((group) =>
        group.agents.map((row) => ({ ...row, machineLabel: machineLabel(group.machineId) })),
      ),
    ).map((row) => {
      const group = { machineId: row.machineId! };
      const selection =
        !row.disabled && source.isCurrentTarget(group.machineId, row)
          ? sessionRoute(group.machineId, row)
          : null;
      const identity = JSON.stringify([group.machineId, row.key]);
      const previousKey = keys.get(identity);
      const previous = previousKey ? targets.get(previousKey) : undefined;
      const key =
        previous && previous.selection === selection && sameAgentTarget(previous.row, row)
          ? previousKey!
          : !selection && previousKey && !previous
            ? previousKey
            : randomUUID();
      nextKeys.set(identity, key);
      if (selection)
        next.set(key, { row: structuredClone(row), machineId: group.machineId, selection });
      return {
        ...row,
        key,
        disabled: !selection,
      };
    });
    const selected = homeMachine();
    const homeRows = rows.filter((row) => selected === null || row.machineId === selected);
    const query = paletteQuery();
    const paletteRows = query === null ? [] : rows.filter((row) => matchesPaletteQuery(row, query));
    const workspaceRows = workspaceActive() ? workspaceAgentRows(rows) : [];
    const visible = new Set(
      [
        ...homeRows.slice(0, 256),
        ...rows.filter((row) => row.attention).slice(0, 256),
        ...paletteRows.slice(0, 256),
        ...workspaceRows.slice(0, 256),
      ].map((row) => row.key),
    );
    targets = new Map([...next].filter(([key]) => visible.has(key)));
    keys = nextKeys;
    const project = (
      groups: ReturnType<Source["getSnapshot"]>,
      visibleRows: HomeAgentRow[],
      home = false,
    ): HomeAgentSnapshot => {
      const observations = groups.flatMap((group) =>
        group.observation && (!home || machineState(group.machineId) === "ready")
          ? [group.observation]
          : [],
      );
      const sum = (
        field:
          | "observedSessions"
          | "totalSessions"
          | "loadingSessions"
          | "unavailableSessions"
          | "truncatedSessions",
      ) => observations.reduce((total, observation) => total + observation[field], 0);
      const incomplete = groups.some((group) => !group.available);
      const loading =
        !groups.length ||
        groups.some(
          (group) =>
            machineState(group.machineId) === "connecting" ||
            (machineState(group.machineId) === "ready" &&
              (!group.observation || group.observation.loadingSessions > 0)),
        );
      const allUnavailable =
        groups.length > 0 &&
        groups.every(
          (group) =>
            machineState(group.machineId) === "disconnected" ||
            group.observation?.phase === "unavailable",
        );
      const phase =
        loading && !sum("observedSessions")
          ? "loading"
          : allUnavailable
            ? "unavailable"
            : incomplete
              ? "partial"
              : "live";
      return {
        phase,
        rows: visibleRows,
        observedSessions: sum("observedSessions"),
        totalSessions: home
          ? groups.reduce(
              (count, group) =>
                count +
                (machineSessions?.(group.machineId) ?? group.observation?.totalSessions ?? 0),
              0,
            )
          : sum("totalSessions"),
        loadingSessions:
          sum("loadingSessions") +
          (home
            ? groups
                .filter((group) => machineState(group.machineId) === "connecting")
                .reduce(
                  (count, group) =>
                    count +
                    (machineSessions?.(group.machineId) ?? group.observation?.totalSessions ?? 0),
                  0,
                )
            : 0),
        unavailableSessions:
          sum("unavailableSessions") +
          (home
            ? groups
                .filter((group) => machineState(group.machineId) === "disconnected")
                .reduce(
                  (count, group) =>
                    count +
                    (machineSessions?.(group.machineId) ?? group.observation?.totalSessions ?? 0),
                  0,
                )
            : 0),
        truncatedSessions: sum("truncatedSessions"),
        refreshingSessionKeys: [],
        unavailableSessionKeys: [],
        note: incomplete
          ? home && groups.every((group) => machineState(group.machineId) === "ready")
            ? "Agent activity observation is incomplete."
            : "Some machines are connecting or unavailable."
          : null,
      };
    };
    homeSnapshot = project(
      groups.filter((group) => selected === null || group.machineId === selected),
      homeRows,
      true,
    );
    workspaceSnapshot = project(groups, workspaceRows);
    if (notify) changed(project(groups, rows));
  };
  return {
    start() {
      stop = source.subscribe(() => refresh());
      source.start();
    },
    refresh,
    sourceSnapshot: () => source.getSnapshot(),
    currentSourceTarget: source.isCurrentTarget,
    homeSnapshot: () => homeSnapshot,
    workspaceSnapshot: () => workspaceSnapshot,
    recover(action: "retry" | "load-more") {
      if (stopped) return;
      if (action === "retry") source.retry();
      else source.loadMore();
    },
    resolve(key: string) {
      const target = targets.get(key);
      if (
        stopped ||
        !target ||
        !source.isCurrentTarget(target.machineId, target.row) ||
        sessionRoute(target.machineId, target.row) !== target.selection
      )
        return null;
      return structuredClone(target);
    },
    dispose() {
      stopped = true;
      stop();
      source.dispose();
      targets.clear();
      keys.clear();
    },
  };
}

/** A semantic pane name alone cannot prove that an observed agent still owns it. */
export function sameAgentTarget(left: HomeAgentRow, right: HomeAgentRow) {
  return (
    left.liveSessionId === right.liveSessionId &&
    left.paneId === right.paneId &&
    left.agentId === right.agentId &&
    left.daemonInstanceId === right.daemonInstanceId &&
    isDeepStrictEqual(left.server, right.server) &&
    isDeepStrictEqual(left.nativeIdentity, right.nativeIdentity) &&
    isDeepStrictEqual(left.interactionEndpoint, right.interactionEndpoint)
  );
}

/** Re-read semantic/native ownership before opening, fenced across both asynchronous reads. */
export async function verifyFleetAgentTarget(
  expected: HomeAgentRow,
  readRows: () => Promise<readonly HomeAgentRow[]>,
  verifyRoute: () => Promise<unknown>,
  current: () => boolean,
): Promise<string> {
  if (!current()) throw new Error("Fleet agent selection changed");
  const rows = await readRows();
  if (!current()) throw new Error("Fleet agent selection changed");
  const row = rows.find((row) => sameAgentTarget(expected, row));
  if (!row?.paneId) throw new Error("Fleet agent pane is no longer available");
  await verifyRoute();
  if (!current()) throw new Error("Fleet agent selection changed");
  return row.paneId;
}
