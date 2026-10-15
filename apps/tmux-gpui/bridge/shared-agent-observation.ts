import type { HomeAgentSnapshot } from "../../../packages/presentation/src/home-agent-roster.ts";
/** One bounded fleet scan shared by Home and transient attention subscribers. */
export function createSharedAgentObservation(
  start: (publish: (value: HomeAgentSnapshot) => void) => () => void,
) {
  const listeners = new Set<(value: HomeAgentSnapshot) => void>();
  let latest: HomeAgentSnapshot | undefined;
  let stop: (() => void) | undefined;
  let epoch = 0;
  return {
    subscribe(listener: (value: HomeAgentSnapshot) => void) {
      listeners.add(listener);
      if (stop) {
        if (latest) listener(latest);
      } else {
        const token = ++epoch;
        stop = start((value) => {
          if (token !== epoch) return;
          latest = value;
          for (const current of [...listeners]) current(value);
        });
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          epoch++;
          stop?.();
          stop = undefined;
          latest = undefined;
        }
      };
    },
    dispose() {
      epoch++;
      listeners.clear();
      stop?.();
      stop = undefined;
      latest = undefined;
    },
  };
}
