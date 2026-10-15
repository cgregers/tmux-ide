import { z } from "zod";
export const homeAgentFilterSchema = z
  .object({
    type: z.literal("home-agent-filter"),
    request: z.number().int().nonnegative().safe(),
    rosterRevision: z.number().int().positive().safe(),
    machineId: z.string().min(1).max(512).nullable(),
  })
  .strict();
/** Display projection only: never changes transport selection or navigation generation. */
export function applyHomeAgentFilter(
  raw: unknown,
  current: {
    request: number;
    revision: number | undefined;
    foreground: boolean;
    home: boolean;
  },
  select: (machineId: string | null) => boolean,
) {
  const parsed = homeAgentFilterSchema.safeParse(raw);
  if (
    !parsed.success ||
    !current.home ||
    !current.foreground ||
    parsed.data.request !== current.request ||
    parsed.data.rosterRevision !== current.revision
  )
    return false;
  return select(parsed.data.machineId);
}
