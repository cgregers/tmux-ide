import {
  SavedMachineSchema,
  SavedMachineRegistrySchema,
  SavedMachineMutationSchema,
  type SavedMachine,
  type SavedMachineRegistry,
  type SavedMachineMutation,
} from "../../../packages/contracts/src/saved-machines.ts";
import {
  loadSavedMachines,
  watchSavedMachines,
} from "../../../packages/daemon/src/lib/saved-machines.ts";
import {
  saveMachineProfiles,
  mutateMachineProfile,
} from "../../../packages/daemon/src/lib/local-fleet-request.ts";

const defaults = {
  read: loadSavedMachines,
  watch: watchSavedMachines,
  save: saveMachineProfiles,
  mutate: mutateMachineProfile,
};
const messages = {
  unavailable: "Saved machines are unavailable. Check the local registry and refresh.",
  stale: "Saved machines changed. Select the machine again.",
  busy: "A machine change is already in progress.",
  inactive: "This saved machine is disabled or no longer available.",
  write: "Could not confirm the saved machine change. Refresh before trying again.",
  stopped: "Machine management is closed.",
} as const;
export class MachineRegistryError extends Error {
  constructor(readonly category: keyof typeof messages) {
    super(messages[category]);
    this.name = "MachineRegistryError";
  }
}

/** Local registry ownership is independent of the currently viewed SSH transport. */
export function createNativeMachineRegistry(changed: () => void, io: typeof defaults = defaults) {
  let registry: SavedMachineRegistry = { version: 1, machines: [] };
  let revision = 0;
  let error: keyof typeof messages | null = null;
  let available = false;
  let pending = false;
  let stopped = false;
  let unwatch = () => {};
  const apply = (next: SavedMachineRegistry | null) => {
    if (stopped) return;
    const nextError = next ? null : "unavailable";
    if (
      JSON.stringify(next ?? registry) !== JSON.stringify(registry) ||
      error !== nextError ||
      available !== !!next
    ) {
      if (next) registry = SavedMachineRegistrySchema.parse(next);
      available = !!next;
      error = nextError;
      revision++;
      changed();
    }
  };
  const refresh = () => {
    if (stopped) return;
    try {
      apply(SavedMachineRegistrySchema.parse(io.read()));
    } catch {
      apply(null);
    }
  };
  const current = (expectedRevision: number) => {
    if (stopped) throw new MachineRegistryError("stopped");
    // Close the window before a filesystem watcher sees an external edit.
    refresh();
    if (!available) throw new MachineRegistryError("unavailable");
    if (revision !== expectedRevision) throw new MachineRegistryError("stale");
  };
  const write = async (expectedRevision: number, action: () => Promise<unknown>) => {
    current(expectedRevision);
    if (pending) throw new MachineRegistryError("busy");
    pending = true;
    error = null;
    changed();
    let failed = false;
    try {
      await action();
    } catch {
      // The daemon may have committed before the response failed. Never replay.
      failed = true;
    } finally {
      pending = false;
      if (!stopped) {
        refresh();
        if (failed) error = "write";
        changed();
      }
    }
    if (failed) throw new MachineRegistryError("write");
  };
  return {
    start() {
      if (stopped) throw new MachineRegistryError("stopped");
      unwatch();
      refresh();
      try {
        unwatch = io.watch(refresh, () => apply(null));
      } catch {
        apply(null);
      }
    },
    refresh,
    publication() {
      return {
        revision,
        available,
        pending,
        error: error ? messages[error] : null,
        // The UI cannot mutate cached profiles through a shared reference.
        machines: structuredClone(registry.machines),
      };
    },
    select(id: string, expectedRevision: number): SavedMachine {
      current(expectedRevision);
      const profile = registry.machines.find((machine) => machine.id === id && machine.enabled);
      if (!profile) throw new MachineRegistryError("inactive");
      return structuredClone(profile);
    },
    save(machine: SavedMachine, expectedRevision: number) {
      const parsed = SavedMachineSchema.parse(machine);
      return write(expectedRevision, () => io.save([parsed]));
    },
    mutate(change: SavedMachineMutation, expectedRevision: number) {
      const parsed = SavedMachineMutationSchema.parse(change);
      return write(expectedRevision, () => io.mutate(parsed));
    },
    dispose() {
      if (stopped) return;
      stopped = true;
      unwatch();
    },
  };
}

/** Display-only edits do not replace a live route; authority changes always do. */
export function savedMachineRouteMatches(
  selected: SavedMachine,
  publication: Pick<
    ReturnType<ReturnType<typeof createNativeMachineRegistry>["publication"]>,
    "available" | "machines"
  >,
): boolean {
  const current = publication.machines.find((machine) => machine.id === selected.id);
  return (
    publication.available &&
    !!current?.enabled &&
    current.sshTarget === selected.sshTarget &&
    current.expectedEnvironmentId === selected.expectedEnvironmentId
  );
}
