import { createFleetPreferences, type FleetPreferenceDependencies } from "./fleet-preferences.ts";
/** One initial read per verified local lifetime, plus explicit refresh. Never a polling loop. */
export function createFleetPreferenceLifecycle(dependencies: FleetPreferenceDependencies) {
  const preferences = createFleetPreferences(dependencies);
  let observed: ReturnType<FleetPreferenceDependencies["getLocalOwner"]> = null;
  let busy = false;
  let writing = false;
  let stopped = false;
  const refresh = async () => {
    if (stopped || busy || writing) return false;
    busy = true;
    try {
      return await preferences.refresh();
    } finally {
      busy = false;
      observe();
    }
  };
  const observe = () => {
    if (stopped) return;
    // snapshot clears retired acknowledgement even while no verified replacement exists.
    const phase = preferences.snapshot().phase;
    if (writing || phase === "loading" || phase === "saving") return;
    const owner = dependencies.getLocalOwner();
    if (busy || owner === observed) return;
    observed = owner;
    if (owner) void refresh();
  };
  return {
    preferences: {
      ...preferences,
      async change(...args: Parameters<typeof preferences.change>) {
        if (writing || stopped) return false;
        writing = true;
        try {
          return await preferences.change(...args);
        } finally {
          writing = false;
          observe();
        }
      },
    },
    observe,
    refresh,
    dispose() {
      stopped = true;
      preferences.dispose();
    },
  };
}
