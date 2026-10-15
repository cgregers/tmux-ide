import { parseDiagnosticLine, type LiveDiagnostic } from "./live-diagnostics.ts";

/** Bounded, allowlisted stderr channel. Never forward arbitrary helper output. */
export function createDiagnosticChannel(receive: (fault: LiveDiagnostic) => void) {
  let pending = "";
  let dropping = false;
  let first: LiveDiagnostic | null = null;
  return {
    get fault() {
      return first;
    },
    push(chunk: Buffer) {
      if (first) return;
      for (const byte of chunk) {
        if (byte === 10) {
          const fault = dropping ? null : parseDiagnosticLine(pending);
          pending = "";
          dropping = false;
          if (fault) {
            first = fault;
            receive(fault);
            return;
          }
        } else if (!dropping) {
          // The protocol is ASCII; malformed/non-ASCII input is discarded.
          if (byte > 127 || pending.length >= 256) {
            pending = "";
            dropping = true;
          } else pending += String.fromCharCode(byte);
        }
      }
    },
  };
}
