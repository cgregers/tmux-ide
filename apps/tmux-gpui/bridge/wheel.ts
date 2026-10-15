import { z } from "zod";
import {
  SessionRuntimeTerminalInputSchemaZ,
  type SessionRuntimeTerminalInput,
} from "../../../packages/contracts/src/session-runtime.ts";
import type { TerminalReplicaSnapshot } from "../../../packages/contracts/src/terminal-replica.ts";
import {
  terminalMouseActionSupported,
  terminalMouseInput,
} from "../../../packages/daemon/src/tui/mirror/runtime/terminal-selection.ts";
export const wheelSchema = z
  .object({
    kind: z.literal("wheel"),
    data: z
      .object({
        lines: z
          .number()
          .int()
          .min(-128)
          .max(128)
          .refine((n) => n !== 0),
        row: z.number().int().min(0).max(16383),
        col: z.number().int().min(0).max(16383),
        shift: z.boolean(),
        alt: z.boolean(),
        control: z.boolean(),
      })
      .strict(),
  })
  .strict();
export function routeWheel(snapshot: TerminalReplicaSnapshot, offset: number, value: unknown) {
  const wheel = wheelSchema.parse(value).data;
  if (wheel.row >= snapshot.rows || wheel.col >= snapshot.cols) return null;
  const action = wheel.lines > 0 ? "wheel-up" : "wheel-down";
  if (offset > 0 || wheel.shift || !terminalMouseActionSupported(snapshot, action))
    return { kind: "history" as const, lines: wheel.lines };
  const input = terminalMouseInput(
    { action, row: wheel.row, column: wheel.col, shift: false, alt: false, ctrl: wheel.control },
    snapshot.modes.mouseEncoding,
  );
  if (!input || (input.kind !== "text" && input.kind !== "bytes")) return null;
  const inputs: SessionRuntimeTerminalInput[] = [];
  let data = "";
  for (let step = 0; step < Math.abs(wheel.lines); step++) {
    const next = data + input.data;
    if (
      data &&
      !SessionRuntimeTerminalInputSchemaZ.safeParse({ kind: input.kind, data: next }).success
    ) {
      inputs.push(SessionRuntimeTerminalInputSchemaZ.parse({ kind: input.kind, data }));
      data = input.data;
    } else data = next;
  }
  if (data) inputs.push(SessionRuntimeTerminalInputSchemaZ.parse({ kind: input.kind, data }));
  return { kind: "application" as const, inputs };
}
