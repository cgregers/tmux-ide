import {
  createNativeMachineRegistry,
  MachineRegistryError,
  savedMachineRouteMatches,
} from "./machines.ts";

/** Save at most once; navigation cancellation can never reconnect a retired request. */
export async function prepareMachineConnection(
  owner: ReturnType<typeof createNativeMachineRegistry>,
  alias: string,
  current: () => boolean,
) {
  if (!current()) return null;
  owner.refresh();
  const before = owner.publication();
  const profile = owner.prepareAdd(alias, before.revision);
  if (before.machines.some((entry) => entry.id === profile.id)) {
    return { profile, persisted: true };
  }
  try {
    await owner.save(profile, before.revision);
  } catch (error) {
    if (!(error instanceof MachineRegistryError) || error.category !== "write") throw error;
    // A failed response may follow a committed save. Read, do not replay.
  }
  if (!current()) return null;
  owner.refresh();
  const after = owner.publication();
  if (!after.available) throw new MachineRegistryError("unavailable");
  if (savedMachineRouteMatches(profile, after)) return { profile, persisted: true };
  // Do not turn a concurrently changed/disabled saved identity into an unpinned route.
  if (after.machines.some((entry) => entry.id === profile.id || entry.sshTarget === alias)) {
    throw new MachineRegistryError("stale");
  }
  return { profile, persisted: false };
}
