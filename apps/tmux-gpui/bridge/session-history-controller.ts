import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createSessionNavigationHistory,
  type SessionHistoryTicket,
} from "./session-navigation-history.ts";
export const sessionHistoryCommandSchema = z
  .object({
    type: z.literal("session-history"),
    request: z.number().int().nonnegative().safe(),
    fromRequest: z.number().int().nonnegative().safe(),
    revision: z.number().int().positive().safe(),
    action: z.uuid(),
  })
  .strict();
type Command = z.infer<typeof sessionHistoryCommandSchema>;
/** Browser supplies freshly verified identities and live-frame acceptance; this owns no transport. */
export function createSessionHistoryController() {
  let core: ReturnType<typeof createSessionNavigationHistory> | null = null;
  let revision = 0,
    request = -1,
    highestAttempt = -1,
    retiredThrough = -1;
  let signature = "";
  let publication: { revision: number; back: string | null; forward: string | null } | null = null;
  let actions = new Map<string, -1 | 1>();
  let pending: { request: number; ticket: SessionHistoryTicket } | null = null;
  let completedCatalog: { request: number; key: string; catalog: object; presence: number } | null =
    null;
  let accepted: { request: number; key: string } | null = null;
  return {
    seed(recent: readonly string[]) {
      if (!core) core = createSessionNavigationHistory(recent);
    },
    publication(currentRequest: number, available: boolean) {
      if (!core || !available) {
        publication = null;
        signature = "";
        actions.clear();
        return null;
      }
      const state = core.snapshot();
      const back = state.entries[state.index - 1],
        forward = state.entries[state.index + 1];
      const canBack = !!back,
        canForward = !!forward;
      const next = JSON.stringify([
        currentRequest,
        state.index,
        state.entries,
        canBack,
        canForward,
        !!pending,
      ]);
      if (signature !== next) {
        signature = next;
        request = currentRequest;
        actions.clear();
        if (revision === Number.MAX_SAFE_INTEGER) {
          publication = null;
          return null;
        }
        publication = {
          revision: ++revision,
          back: !pending && canBack ? randomUUID() : null,
          forward: !pending && canForward ? randomUUID() : null,
        };
        if (publication.back) actions.set(publication.back, -1);
        if (publication.forward) actions.set(publication.forward, 1);
      }
      return publication;
    },
    admit(
      command: Command,
      currentRequest: number,
      foreground: boolean,
      resolve: (key: string) => boolean,
    ) {
      if (command.request <= currentRequest || command.request <= highestAttempt) return null;
      highestAttempt = command.request;
      const direction = actions.get(command.action);
      if (
        !core ||
        !foreground ||
        command.fromRequest !== currentRequest ||
        request !== currentRequest ||
        command.revision !== publication?.revision ||
        direction === undefined
      )
        return null;
      const ticket = core.beginTraversal(command.request, direction, resolve);
      if (!ticket) return null;
      pending = { request: command.request, ticket };
      completedCatalog = null;
      signature = "";
      actions.clear();
      return ticket.key;
    },
    // Metadata helpers retire after publishing their complete catalog. Retain only
    // this authority proof, never the child process or a cached navigation token.
    catalogReady(request: number, key: string, catalog: object, presence: number) {
      if (pending?.request !== request || pending.ticket.key !== key) return false;
      completedCatalog = { request, key, catalog, presence };
      return true;
    },
    navigation(
      nextRequest: number,
      continuation?: { fromRequest: number; key: string; catalog: object; presence: number },
    ) {
      if (
        pending &&
        continuation &&
        completedCatalog?.request === continuation.fromRequest &&
        completedCatalog.key === continuation.key &&
        completedCatalog.catalog === continuation.catalog &&
        completedCatalog.presence === continuation.presence &&
        pending.request === continuation.fromRequest &&
        pending.ticket.key === continuation.key &&
        nextRequest > pending.request
      )
        pending.request = nextRequest;
      if (pending?.request !== nextRequest) {
        retiredThrough = Math.max(retiredThrough, pending?.request ?? -1);
        core?.cancel();
        pending = null;
      }
      completedCatalog = null;
      signature = "";
      actions.clear();
    },
    cancel() {
      completedCatalog = null;
      retiredThrough = Math.max(retiredThrough, pending?.request ?? -1);
      core?.cancel();
      pending = null;
      signature = "";
      actions.clear();
    },
    accept(currentRequest: number, key: string) {
      if (!core || currentRequest <= retiredThrough) return null;
      if (accepted?.request === currentRequest && accepted.key === key) return null;
      let ticket: SessionHistoryTicket | null;
      if (pending) {
        if (pending.request !== currentRequest) return null;
        ticket = pending.ticket;
        retiredThrough = Math.max(retiredThrough, currentRequest);
        pending = null;
      } else ticket = core.beginVisit(currentRequest, key);
      if (!ticket) return null;
      const visit = core.complete(ticket, { accepted: true, key });
      if (visit) {
        accepted = { request: currentRequest, key };
        signature = "";
      }
      return visit;
    },
  };
}
