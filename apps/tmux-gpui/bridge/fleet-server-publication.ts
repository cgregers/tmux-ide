/** Additive native fleet hierarchy. Flat sessions remain the compatibility route index. */
export interface NativeFleetServer {
  id: string;
  label: string;
  state: "online" | "offline";
  generation: string | null;
  selection: string | null;
}
export interface NativeSelectedServer {
  machineId: string;
  machineLabel: string;
  serverId: string;
  generation: string;
  label: string;
}
