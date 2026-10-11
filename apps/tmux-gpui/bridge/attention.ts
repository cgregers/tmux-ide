import { discoveredAgentRequest } from "./fleet-agent-admission.ts";
import { z } from "zod";
import { homeAgentPublication, openAgentSchema } from "./home-agent-publication.ts";
import type { HomeAgentSnapshot } from "../../../packages/presentation/src/home-agent-roster.ts";
export const attentionObserveSchema = z
  .object({
    type: z.literal("attention-observe"),
    request: z.number().int().nonnegative().safe(),
    scope: z.number().int().positive().safe(),
    active: z.boolean(),
  })
  .strict();
export const openAttentionAgentSchema = openAgentSchema.extend({
  type: z.literal("open-attention-agent"),
  scope: z.number().int().positive().safe(),
});
type Fleet = Pick<
  ReturnType<typeof import("./fleet-runtime.ts").createNativeFleetRuntime>,
  "observeAgents" | "resolveAgent"
>;
export function createAttentionOwner(changed: () => void) {
  let highestAttempt = 0;
  let highest = 0,
    revision = 0,
    epoch = 0;
  let active: { request: number; scope: number } | null = null;
  let stop: (() => void) | undefined;
  let publication: (ReturnType<typeof homeAgentPublication> & { scope: number }) | null = null;
  const cancel = () => {
    epoch++;
    active = null;
    stop?.();
    stop = undefined;
    publication = null;
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
      command: z.infer<typeof attentionObserveSchema>,
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
      cancel();
      highest = command.scope;
      active = { request, scope: command.scope };
      const captured = epoch;
      const publish = (value: HomeAgentSnapshot) => {
        if (captured !== epoch || !active) return;
        publication = {
          ...homeAgentPublication(
            { ...value, rows: value.rows.filter((row) => row.attention) },
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
        note: fleet ? null : "Fleet attention observations are unavailable for this connection.",
      };
      publish(empty);
      if (fleet) stop = fleet.observeAgents(publish);
    },
    resolve(
      command: z.infer<typeof openAttentionAgentSchema>,
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
        !publication.rows.some((row) => row.key === command.key && row.attention && row.available)
      )
        return null;
      return fleet?.resolveAgent(command.key) ?? null;
    },
  };
}
