import { discoveredAgentRequest } from "./fleet-agent-admission.ts";
import { z } from "zod";
import { homeAgentPublication, openAgentSchema } from "./home-agent-publication.ts";
import type { HomeAgentSnapshot } from "../../../packages/presentation/src/home-agent-roster.ts";
export const paletteObserveSchema = z
  .object({
    type: z.literal("palette-observe"),
    request: z.number().int().nonnegative().safe(),
    scope: z.number().int().positive().safe(),
    active: z.boolean(),
    query: z
      .string()
      .refine((value) => Array.from(value).length <= 256)
      .default(""),
  })
  .strict();
export const openPaletteAgentSchema = openAgentSchema.extend({
  type: z.literal("open-palette-agent"),
  scope: z.number().int().positive().safe(),
});
type Fleet = Pick<
  ReturnType<typeof import("./fleet-runtime.ts").createNativeFleetRuntime>,
  "observePaletteAgents" | "resolveAgent"
>;
export function createPaletteOwner(changed: () => void) {
  let highestAttempt = 0;
  let highest = 0,
    revision = 0,
    epoch = 0;
  let active: { request: number; scope: number; query: string } | null = null;
  let stop: ReturnType<Fleet["observePaletteAgents"]> | undefined;
  let publication: (ReturnType<typeof homeAgentPublication> & { scope: number }) | null = null;
  const cancel = () => {
    epoch++;
    active = null;
    publication = null;
    const previousStop = stop;
    stop = undefined;
    previousStop?.dispose();
  };
  return {
    cancel,
    admitAttempt(attempt: number, request: number) {
      if (attempt <= request || attempt <= highestAttempt) return false;
      highestAttempt = attempt;
      return true;
    },
    latest: (scope: number) => highest === scope,
    publication: () => publication,
    observe(
      command: z.infer<typeof paletteObserveSchema>,
      request: number,
      foreground: boolean,
      fleet: Fleet | undefined,
    ) {
      if (command.request !== request) return;
      if (!command.active) {
        if (active?.scope === command.scope) {
          cancel();
          changed();
        }
        return;
      }
      if (!foreground || command.scope <= highest) return;
      if (!stop) cancel();
      highest = command.scope;
      active = { request, scope: command.scope, query: command.query };
      const captured = epoch;
      const publish = (value: HomeAgentSnapshot) => {
        if (captured !== epoch || !active) return;
        publication = {
          ...homeAgentPublication(
            { ...value, rows: value.rows.filter((row) => matchesPaletteQuery(row, active!.query)) },
            ++revision,
            (row) => !!discoveredAgentRequest(fleet?.resolveAgent(row.key)?.row),
          ),
          scope: active.scope,
        };
        changed();
      };
      const empty: HomeAgentSnapshot = {
        phase: fleet ? "loading" : "unavailable",
        rows: [],
        observedSessions: 0,
        totalSessions: 0,
        loadingSessions: 0,
        unavailableSessions: 0,
        truncatedSessions: 0,
        refreshingSessionKeys: [],
        unavailableSessionKeys: [],
        note: fleet ? null : "Fleet agent observations are unavailable for this connection.",
      };
      publish(empty);
      if (fleet && captured === epoch) {
        if (stop) stop.update(command.query);
        else {
          const subscription = fleet.observePaletteAgents(command.query, publish);
          if (captured === epoch) stop = subscription;
          else subscription.dispose();
        }
      }
    },
    resolve(
      command: z.infer<typeof openPaletteAgentSchema>,
      request: number,
      foreground: boolean,
      fleet: Fleet | undefined,
    ) {
      if (
        !foreground ||
        command.fromRequest !== request ||
        command.request <= request ||
        active?.request !== request ||
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

/** Match every F5 query term before the wire/route cap, using shared display metadata. */
export function matchesPaletteQuery(
  row: import("../../../packages/presentation/src/home-agent-roster.ts").HomeAgentRow,
  query: string,
) {
  const fields = [
    "jump to agent workspace",
    row.name,
    row.sessionName,
    row.machineLabel,
    row.serverLabel,
    row.projectName,
    row.harness,
    row.team?.name,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
  return query
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean)
    .every((term) => fields.some((value) => value.includes(term)));
}
