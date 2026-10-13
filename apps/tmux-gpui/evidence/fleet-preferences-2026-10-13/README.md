# Local fleet preference ownership — bridge groundwork

This is a local, not yet integrated implementation slice. No favorite/collapse
controls have been enabled; daemon APIs and disk formats are unchanged.

The adapter accepts only explicit favorite/collapse intents against its current
acknowledged revision. It serializes one operation, never replays uncertain writes,
bounds response bytes and time, validates shared schemas and daemon identity,
and discards results from retired owners. UI observer failure cannot strand it.
The separate production binding requests only the verified local manager handle,
pins loopback URL and credentials, and checks handle/epoch/full identity before
and after HTTP. It never asks for the selected SSH route.

13 focused tests passed, covering an isolated local HTTP server, shared reducer
idempotence, duplicate explicit intents, stale authority, cancellation, response
size, maximum catalog, observer failure and mutable request/discovery records.
These tests do not prove live TUI/GPUI persistence or native control behavior.

Next: integrate lifecycle refresh and opaque action mappings into fleet-runtime
and fleet publications, then native controls with existing TUI collapse exceptions.
Cross-client reload and private-daemon persistence checks remain required.

Independent four-file review approved the final source. Bridge typecheck
(`pnpm exec tsc -p apps/tmux-gpui/bridge/tsconfig.json`) and ESLint on the four
fleet-preferences adapter/owner files passed with Node24 on PATH. Focused tests:
`node --import tsx --test apps/tmux-gpui/bridge/fleet-preferences-owner.test.ts apps/tmux-gpui/bridge/fleet-preferences.test.ts`.
No Rust or native build was needed for these unintegrated TypeScript modules.
