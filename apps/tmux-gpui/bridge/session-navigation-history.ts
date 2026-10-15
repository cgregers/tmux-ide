import {
  FleetClientStateSchema,
  FleetClientStateChangeSchema,
} from "../../../packages/contracts/src/fleet-client-state.ts";

export interface SessionHistoryTicket {
  readonly attempt: number;
  readonly key: string;
}
export type SessionHistoryOutcome =
  | { readonly accepted: true; readonly key: string }
  | { readonly accepted: false };
interface Pending {
  ticket: SessionHistoryTicket;
  index: number | null;
}

/** Session navigation, not terminal scrollback. Stores canonical keys, never route capabilities.
 * The caller resolves a fresh exact identity before traversal admission and supplies accepted
 * only after its current request/child/route lifetime has a successful live attachment.
 * Returned visit intents are not persisted here; the existing local writer must acknowledge them.
 */
export function createSessionNavigationHistory(savedRecent: readonly string[] = []) {
  const recent = FleetClientStateSchema.shape.recent.parse(savedRecent);
  // Canonical recents are newest first. Keep the newest occurrence if malformed callers repeat it.
  const entries = [...new Set(recent)].reverse();
  let index = entries.length - 1;
  let highestAttempt = -1;
  let lifetime = {};
  let pending: Pending | null = null;
  let disposed = false;
  const admit = (attempt: number) => {
    if (disposed || !Number.isSafeInteger(attempt) || attempt < 0 || attempt <= highestAttempt)
      return false;
    highestAttempt = attempt;
    lifetime = {};
    pending = null;
    return true;
  };
  const capture = (attempt: number, key: string, nextIndex: number | null) => {
    const ticket = Object.freeze({ attempt, key });
    pending = { ticket, index: nextIndex };
    return ticket;
  };
  return {
    snapshot() {
      return {
        entries: [...entries],
        index,
        pending: pending ? { ...pending.ticket } : null,
      };
    },
    beginVisit(attempt: number, key: string): SessionHistoryTicket | null {
      if (!admit(attempt)) return null;
      const parsed = FleetClientStateChangeSchema.safeParse({ type: "visit", key });
      if (!parsed.success) return null;
      return capture(attempt, key, null);
    },
    beginTraversal(
      attempt: number,
      direction: -1 | 1,
      isAvailable: (key: string) => boolean,
    ): SessionHistoryTicket | null {
      if (!admit(attempt) || (direction !== -1 && direction !== 1)) return null;
      const captured = lifetime;
      const next = index + direction;
      const key = entries[next];
      if (key === undefined) return null;
      try {
        if (!isAvailable(key)) return null;
      } catch {
        return null;
      }
      // The availability callback may synchronously retire or supersede this attempt.
      if (disposed || highestAttempt !== attempt || lifetime !== captured) return null;
      return capture(attempt, key, next);
    },
    complete(ticket: SessionHistoryTicket, outcome: SessionHistoryOutcome) {
      if (disposed || pending?.ticket !== ticket) return null;
      const current = pending;
      pending = null;
      if (!outcome.accepted || outcome.key !== ticket.key) return null;
      if (current.index !== null) index = current.index;
      else if (entries[index] !== ticket.key) {
        entries.splice(index + 1);
        entries.push(ticket.key);
        if (entries.length > 64) entries.shift();
        index = entries.length - 1;
      }
      return { type: "visit" as const, key: ticket.key };
    },
    cancel() {
      lifetime = {};
      pending = null;
    },
    dispose() {
      disposed = true;
      lifetime = {};
      pending = null;
    },
  };
}
