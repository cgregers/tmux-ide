import { randomUUID } from "node:crypto";
import { z } from "zod";
import { FleetClientStateChangeSchema } from "../../../packages/contracts/src/fleet-client-state.ts";
import type {
  MachineCatalogGroup,
  MachineCatalogSession,
} from "../../../packages/daemon/src/lib/machine-catalog.ts";
import type { FleetPreferenceSnapshot, createFleetPreferences } from "./fleet-preferences.ts";

export const fleetPreferenceCommand = z.strictObject({
  type: z.literal("fleet-preference"),
  request: z.number().int().nonnegative().safe(),
  revision: z.number().int().nonnegative().safe(),
  action: z.uuid(),
  enabled: z.boolean(),
});
export type FleetPreferenceOwner = ReturnType<typeof createFleetPreferences>;
/** Display projection only: private keys never become command arguments. */
export function createFleetPreferencePublication(owner?: FleetPreferenceOwner) {
  let actions = new Map<string, { type: "favorite" | "collapse"; key: string }>();
  let revision = 0;
  let state: FleetPreferenceSnapshot | undefined;
  let active: string | null = null;
  const favorite = (id: string) => state?.state?.favorites.includes(id) ?? false;
  const priority = (session: MachineCatalogSession) =>
    session.id === active ? 0 : favorite(session.id) ? 1 : 2;
  const action = (type: "favorite" | "collapse", key: string) => {
    if (
      state?.phase !== "ready" ||
      revision === Number.MAX_SAFE_INTEGER ||
      !FleetClientStateChangeSchema.safeParse({ type, key, enabled: true }).success
    )
      return null;
    const token = randomUUID();
    actions.set(token, { type, key });
    return token;
  };
  return {
    begin(groups: readonly MachineCatalogGroup[], selected: string | null) {
      active = selected;
      state = owner?.snapshot();
      if (revision < Number.MAX_SAFE_INTEGER) revision++;
      actions = new Map();
      // Reserve the bounded budget globally for active/favorite rows before ordinary rows.
      const ordered = [...groups]
        .sort(
          (a, b) =>
            a.sessions.reduce((rank, s) => Math.min(rank, priority(s)), 2) -
            b.sessions.reduce((rank, s) => Math.min(rank, priority(s)), 2),
        )
        .slice(0, 64);
      const rows = ordered.flatMap((group) =>
        [...group.sessions]
          .sort((a, b) => priority(a) - priority(b))
          .slice(0, 128)
          .map((session) => ({ group, session })),
      );
      rows.sort((a, b) => priority(a.session) - priority(b.session));
      const admitted = new Set(rows.slice(0, 512).map((row) => row.session));
      return ordered.map((group) => ({
        group,
        sessions: group.sessions
          .filter((session) => admitted.has(session))
          .sort((a, b) => priority(a) - priority(b)),
      }));
    },
    metadata() {
      return state ? { revision, phase: state.phase, error: state.error } : undefined;
    },
    group(group: MachineCatalogGroup) {
      const key = group.environmentId ?? group.id;
      return {
        collapsed: state?.state?.collapsed.includes(key) ?? false,
        collapseAction: action("collapse", key),
      };
    },
    session(session: MachineCatalogSession) {
      return {
        favorite: favorite(session.id),
        favoriteAction: action("favorite", session.id),
        active: session.id === active,
      };
    },
    async command(raw: unknown, current: { request: number; foreground: boolean }) {
      const parsed = fleetPreferenceCommand.safeParse(raw);
      if (
        !parsed.success ||
        !current.foreground ||
        parsed.data.request !== current.request ||
        !owner
      )
        return false;
      const cmd = parsed.data;
      const target = actions.get(cmd.action);
      if (!target || cmd.revision !== revision || owner.snapshot().revision !== state?.revision)
        return false;
      actions.clear(); // Consume all displayed capabilities before the asynchronous write.
      return owner.change(state!.revision, { ...target, enabled: cmd.enabled });
    },
  };
}
