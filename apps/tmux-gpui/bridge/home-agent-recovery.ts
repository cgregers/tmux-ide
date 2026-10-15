import { z } from "zod";
import type { HomeAgentSnapshot } from "../../../packages/presentation/src/home-agent-roster.ts";
export const homeAgentRecoverySchema = z
  .object({
    type: z.literal("home-agent-recovery"),
    request: z.number().int().nonnegative().safe(),
    rosterRevision: z.number().int().positive().safe(),
    action: z.enum(["retry", "load-more"]),
  })
  .strict();
/** Recovery belongs to the resident observation; it never reconnects a machine. */
export function createHomeAgentRecovery() {
  let state: { revision: number; canRetry: boolean; canLoadMore: boolean } | null = null;
  let consumed = false;
  return {
    adopt(snapshot: HomeAgentSnapshot, revision: number) {
      state = {
        revision,
        canRetry: snapshot.phase === "unavailable" || snapshot.unavailableSessions > 0,
        // Session coverage can grow independently of the bounded native row projection.
        canLoadMore: snapshot.truncatedSessions > 0,
      };
      consumed = false;
    },
    clear() {
      state = null;
      consumed = false;
    },
    publication() {
      return state
        ? {
            ...state,
            canRetry: !consumed && state.canRetry,
            canLoadMore: !consumed && state.canLoadMore,
          }
        : null;
    },
    command(
      raw: unknown,
      current: { request: number; home: boolean; foreground: boolean },
      dispatch: (action: "retry" | "load-more") => void,
    ) {
      const parsed = homeAgentRecoverySchema.safeParse(raw);
      if (!parsed.success || !current.home || !current.foreground || !state || consumed)
        return false;
      const cmd = parsed.data;
      if (
        cmd.request !== current.request ||
        cmd.rosterRevision !== state.revision ||
        !(cmd.action === "retry" ? state.canRetry : state.canLoadMore)
      )
        return false;
      consumed = true; // Consume before synchronous observers can publish/reenter.
      dispatch(cmd.action);
      return true;
    },
  };
}
