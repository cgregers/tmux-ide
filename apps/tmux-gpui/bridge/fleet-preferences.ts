import {
  FleetClientStateRequestSchema,
  FleetClientStateResponseSchema,
  FleetClientStateSchema,
  FleetClientStateChangeSchema,
  type FleetClientState,
} from "../../../packages/contracts/src/fleet-client-state.ts";

/** Stable process-private object per verified LOCAL manager handle/auth/endpoint epoch.
 * The binding owns authentication and redirect refusal; never construct this from UI data.
 * assertCurrent must check the manager handle, credentials, endpoint and daemon identity.
 */
export interface VerifiedLocalFleetPreferenceOwner {
  readonly kind: "local";
  readonly instanceId: string;
  readonly startedAt: string;
  assertCurrent(): void;
  request(input: {
    readonly method: "GET" | "POST";
    readonly body?: string;
    readonly signal: AbortSignal;
  }): Promise<Response>;
}
export interface FleetPreferenceDependencies {
  getLocalOwner(): VerifiedLocalFleetPreferenceOwner | null;
  changed?(): void;
}
export interface FleetPreferenceSnapshot {
  revision: number;
  phase: "unavailable" | "loading" | "ready" | "saving" | "failed";
  state: FleetClientState | null;
  error: string | null;
}
// 64 routes ×64 sessions, each with two1024 and two255-unit strings plus scope,
// allow even six-byte JSON escapes per bounded string unit, preferences and overhead.
// Unbounded productVersion or whitespace remains subject to this explicit wire budget.
export const FLEET_PREFERENCE_RESPONSE_BYTES = 64 * 1024 * 1024;
const unavailable = "Fleet preferences are unavailable. Refresh the local connection.";
const failed = "Could not confirm fleet preferences. Refresh before trying again.";

export function createFleetPreferences(dependencies: FleetPreferenceDependencies) {
  let publication: FleetPreferenceSnapshot = {
    revision: 0,
    phase: "unavailable",
    state: null,
    error: null,
  };
  let acknowledgedOwner: {
    owner: VerifiedLocalFleetPreferenceOwner;
    instanceId: string;
    startedAt: string;
  } | null = null;
  let pending = false;
  let disposed = false;
  let drainingVisits = false;
  const visits: {
    key: string;
    owner: VerifiedLocalFleetPreferenceOwner;
    instanceId: string;
    startedAt: string;
    resolve: (accepted: boolean) => void;
  }[] = [];
  const rejectVisits = () => {
    for (const visit of visits.splice(0)) visit.resolve(false);
  };
  const lifetime = new AbortController();
  const publish = (
    phase: FleetPreferenceSnapshot["phase"],
    state: FleetClientState | null,
    error: string | null,
  ) => {
    publication = { revision: publication.revision + 1, phase, state, error };
    // Notification failure must not strand the serialized owner or replay a write.
    try {
      dependencies.changed?.();
    } catch {
      /* The caller can still read the snapshot. */
    }
  };
  const assertOwner = (
    owner: VerifiedLocalFleetPreferenceOwner,
    instanceId: string,
    startedAt: string,
    signal?: AbortSignal,
  ) => {
    signal?.throwIfAborted();
    if (
      disposed ||
      owner.kind !== "local" ||
      dependencies.getLocalOwner() !== owner ||
      owner.instanceId !== instanceId ||
      owner.startedAt !== startedAt
    )
      throw new Error("retired");
    owner.assertCurrent();
  };
  const current = () => {
    if (acknowledgedOwner) {
      try {
        assertOwner(
          acknowledgedOwner.owner,
          acknowledgedOwner.instanceId,
          acknowledgedOwner.startedAt,
        );
      } catch {
        acknowledgedOwner = null;
        publish("unavailable", null, unavailable);
      }
    }
  };
  const run = async (
    rawChange: unknown | undefined,
    signal?: AbortSignal,
    visit = false,
  ): Promise<boolean> => {
    if (disposed || pending) return false;
    current();
    let owner: VerifiedLocalFleetPreferenceOwner | null;
    try {
      owner = dependencies.getLocalOwner();
    } catch {
      acknowledgedOwner = null;
      publish("unavailable", null, unavailable);
      return false;
    }
    if (!owner || owner.kind !== "local") {
      acknowledgedOwner = null;
      publish("unavailable", null, unavailable);
      return false;
    }
    const instanceId = owner.instanceId,
      startedAt = owner.startedAt;
    let body: string | undefined;
    try {
      assertOwner(owner, instanceId, startedAt, signal);
      if (rawChange !== undefined) {
        const request = FleetClientStateRequestSchema.parse({
          expectedInstanceId: instanceId,
          change: rawChange,
        });
        if (
          visit
            ? request.change.type !== "visit"
            : request.change.type !== "favorite" && request.change.type !== "collapse"
        )
          return false;
        body = JSON.stringify(request);
      }
    } catch {
      return false;
    }
    pending = true;
    const operation = AbortSignal.any([
      lifetime.signal,
      AbortSignal.timeout(3000),
      ...(signal ? [signal] : []),
    ]);
    publish(body ? "saving" : "loading", publication.state, null);
    let removeAbort = () => {};
    try {
      const aborted = new Promise<never>((_, reject) => {
        const abort = () => reject(new Error("aborted"));
        operation.addEventListener("abort", abort, { once: true });
        removeAbort = () => operation.removeEventListener("abort", abort);
        if (operation.aborted) abort();
      });
      const read = async () => {
        assertOwner(owner, instanceId, startedAt, operation);
        const response = await owner.request({
          method: body ? "POST" : "GET",
          ...(body ? { body } : {}),
          signal: operation,
        });
        try {
          assertOwner(owner, instanceId, startedAt, operation);
        } catch (error) {
          void response.body?.cancel().catch(() => {});
          throw error;
        }
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          throw new Error("response");
        }
        const reader = response.body.getReader();
        const cancel = () => {
          void reader.cancel().catch(() => {});
        };
        operation.addEventListener("abort", cancel, { once: true });
        let length = 0;
        const chunks: Uint8Array[] = [];
        try {
          for (;;) {
            const item = await reader.read();
            assertOwner(owner, instanceId, startedAt, operation);
            if (item.done) break;
            length += item.value.byteLength;
            if (length > FLEET_PREFERENCE_RESPONSE_BYTES) throw new Error("size");
            chunks.push(item.value);
          }
        } finally {
          operation.removeEventListener("abort", cancel);
          await reader.cancel().catch(() => {});
        }
        assertOwner(owner, instanceId, startedAt, operation);
        const result = FleetClientStateResponseSchema.parse(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        if (result.daemon.instanceId !== instanceId || result.daemon.startedAt !== startedAt)
          throw new Error("identity");
        return result.state;
      };
      const state = await Promise.race([read(), aborted]);
      assertOwner(owner, instanceId, startedAt, operation);
      acknowledgedOwner = { owner, instanceId, startedAt };
      publish("ready", state, null);
      return true;
    } catch {
      acknowledgedOwner = null;
      if (!disposed) publish("failed", null, failed);
      return false;
    } finally {
      removeAbort();
      pending = false;
      void drainVisits();
    }
  };
  const drainVisits = async () => {
    if (pending || drainingVisits || disposed) return;
    drainingVisits = true;
    try {
      while (visits.length) {
        const visit = visits.shift()!;
        try {
          assertOwner(visit.owner, visit.instanceId, visit.startedAt);
          if (
            publication.phase !== "ready" ||
            acknowledgedOwner?.owner !== visit.owner ||
            acknowledgedOwner.instanceId !== visit.instanceId ||
            acknowledgedOwner.startedAt !== visit.startedAt
          )
            throw new Error("unacknowledged");
        } catch {
          visit.resolve(false);
          rejectVisits();
          return;
        }
        const accepted = await run({ type: "visit", key: visit.key }, undefined, true);
        visit.resolve(accepted);
        // A failed write may already have reached storage. Never retry it or
        // silently continue queued changes against an unacknowledged owner.
        if (!accepted) {
          rejectVisits();
          return;
        }
      }
    } finally {
      drainingVisits = false;
    }
  };
  return {
    snapshot(): FleetPreferenceSnapshot {
      current();
      return {
        ...publication,
        state: publication.state ? FleetClientStateSchema.parse(publication.state) : null,
      };
    },
    refresh(signal?: AbortSignal) {
      return run(undefined, signal);
    },
    change(expectedRevision: number, rawChange: unknown, signal?: AbortSignal) {
      current();
      if (
        rawChange === undefined ||
        disposed ||
        pending ||
        publication.phase !== "ready" ||
        publication.revision !== expectedRevision
      )
        return Promise.resolve(false);
      return run(rawChange, signal);
    },
    /** Internal accepted-session notification, never a native UI mutation route.
     * The caller must establish a current coherent live attachment first. This
     * returns false on uncertain persistence; it never replays accepted visits.
     */
    recordVisit(key: string): Promise<boolean> {
      current();
      if (disposed || visits.length >= 64 || (!pending && publication.phase !== "ready"))
        return Promise.resolve(false);
      const change = FleetClientStateChangeSchema.safeParse({ type: "visit", key });
      if (!change.success || change.data.type !== "visit") return Promise.resolve(false);
      const parsedKey = change.data.key;
      let owner: VerifiedLocalFleetPreferenceOwner | null;
      try {
        owner = dependencies.getLocalOwner();
        if (!owner) return Promise.resolve(false);
        assertOwner(owner, owner.instanceId, owner.startedAt);
      } catch {
        return Promise.resolve(false);
      }
      const captured = owner;
      return new Promise<boolean>((resolve) => {
        visits.push({
          key: parsedKey,
          owner: captured,
          instanceId: captured.instanceId,
          startedAt: captured.startedAt,
          resolve,
        });
        void drainVisits();
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      rejectVisits();
      acknowledgedOwner = null;
      publication = {
        revision: publication.revision + 1,
        phase: "unavailable",
        state: null,
        error: null,
      };
    },
  };
}
