import { ephemeralMachineProfile } from "../../../lib/machine-profile.ts";
export { ephemeralMachineProfile } from "../../../lib/machine-profile.ts";
import { resolveRuntimeNamespace } from "../../../lib/runtime-namespace.ts";
import { type SavedMachine } from "@tmux-ide/contracts";
import { loadSavedMachines, watchSavedMachines } from "../../../lib/saved-machines.ts";
import { applicationMachineAuthorityManager } from "./application-machine-authority.ts";
import { tuiPerfMark } from "./application-performance-log.ts";

/** Local discovery and rendering never wait for any remote handshake. */
export function initializeApplicationMachines(aliases: readonly string[]): void {
  const development = resolveRuntimeNamespace().development;
  const profiles = development ? [] : [...loadSavedMachines().machines];
  const ephemeral: SavedMachine[] = [];
  let preferred: string | null = null;
  for (const alias of aliases) {
    let profile = profiles.find((p) => p.sshTarget === alias && p.enabled);
    if (!profile) {
      profile = ephemeralMachineProfile(alias, profiles);
      profiles.push(profile);
      ephemeral.push(profile);
    }
    preferred ??= profile.id;
  }
  applicationMachineAuthorityManager.initialize(profiles);
  if (preferred) applicationMachineAuthorityManager.select(preferred);
  if (!development) {
    const failed = () =>
      tuiPerfMark("machine-registry-error", { reason: "registry-unavailable-or-invalid" });
    try {
      applicationMachineAuthorityManager.followProfiles((onChange) =>
        watchSavedMachines((registry) => {
          const next = [...registry.machines];
          for (let index = 0; index < ephemeral.length; index++) {
            let profile = ephemeral[index]!;
            // A newly saved route may claim an ephemeral display label. Keep the
            // explicit connection's identity while making the label unambiguous.
            if (
              next.some(
                (entry) =>
                  entry.label.normalize("NFKC").toLowerCase() ===
                  profile.label.normalize("NFKC").toLowerCase(),
              )
            )
              profile = {
                ...profile,
                label: ephemeralMachineProfile(profile.sshTarget, next).label,
              };
            ephemeral[index] = profile;
            next.push(profile);
          }
          onChange(next);
        }, failed),
      );
    } catch {
      failed();
    }
  }
}
