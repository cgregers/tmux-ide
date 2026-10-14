import { createDaemonConnectionOwner } from "../../../packages/daemon/src/lib/daemon-connection-owner.ts";
import { discoverPreviewDaemon } from "./discovery.ts";

/** Preserve the native client's credential-free identity probe before catalog traffic. */
export function createFleetConnectionOwner(
  dependencies = {
    createOwner: createDaemonConnectionOwner,
    discover: discoverPreviewDaemon,
    now: Date.now,
  },
) {
  const owner = dependencies.createOwner();
  const listeners = new Set<Parameters<typeof owner.observe>[0]>();
  let verified: string | null = null;
  let revision = 0;
  let stopped = false;
  let pending: Promise<void> | null = null;
  let nextAttempt = 0;
  const verify = async () => {
    verified = null;
    const token = ++revision;
    try {
      const info = await dependencies.discover();
      if (!stopped && token === revision) verified = JSON.stringify(info);
    } catch {
      /* The catalog publishes unavailable; private probe errors stay internal. */
    }
  };
  const check = () => {
    if (pending || stopped || dependencies.now() < nextAttempt) return pending ?? Promise.resolve();
    nextAttempt = dependencies.now() + 1000;
    pending = verify().finally(() => {
      pending = null;
      if (!stopped) for (const listener of listeners) listener(owner.read()?.instanceId ?? null);
    });
    return pending;
  };
  return {
    ...owner,
    read() {
      const info = owner.read();
      if (owner.endpoint().kind === "ssh") return info;
      if (verified && JSON.stringify(info) === verified) return info;
      verified = null;
      void check();
      return null;
    },
    async observe(listener: Parameters<typeof owner.observe>[0]) {
      if (owner.endpoint().kind === "ssh") return owner.observe(listener);
      listeners.add(listener);
      const stop = await owner.observe(() => {
        verified = null;
        revision++;
        nextAttempt = 0;
        listener(null);
        void check();
      });
      await check();
      return () => {
        listeners.delete(listener);
        stop();
      };
    },
    dispose() {
      stopped = true;
      revision++;
      verified = null;
      listeners.clear();
      owner.dispose();
    },
  };
}
