# Local font preview handoff

The tested Font QA app was copied to `/Users/thijs/Applications/Tmux IDE Font Preview.app`. All 21 regular files matched before only the bundle identifier and display name were changed to distinguish it from the existing Alpha. Native binary SHA-256 is recorded in receipt.json. This is a durable unsigned local development copy, not an installer or distribution acceptance proof. The running Alpha and production tmux sessions were not touched; the new app was not launched.

The font save/restart path is qualified by `../terminal-font-2026-10-12/physical-pass.json`. The intermittent native runtime-failure remains unexplained. Packaged helper controls passed in `../runtime-fault-controls-2026-10-12/`, which do not prove native event ordering. A separately instrumented Connection Trace app was prepared, but native UI control returned noWindowsAvailable; that run was deliberately cancelled and owned fixture cleanup completed. No new failure diagnosis is claimed.

Hosted run 38216255688 remains in macOS app assembly/test at this checkpoint. Its Linux bridge job failed on the older revision; reviewed local fix 845a9891 awaits fresh hosted verification. Signing/public publication remain on hold for user testing.
