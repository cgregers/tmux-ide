# Local fleet preferences — ownership and integration

The initial committed slice provided the local preference adapter and owner binding.
The working-tree integration now connects Home favorite/collapse controls; native
acceptance and full Rust gates are still pending. Daemon APIs and disk formats
are unchanged.

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

The subsequent integration implements lifecycle refresh, opaque action mappings
and native controls with the TUI collapse exceptions. Full cross-client frontend
reload and private canonical-daemon acceptance checks remain required.

Independent four-file review approved the final source. Bridge typecheck
(`pnpm exec tsc -p apps/tmux-gpui/bridge/tsconfig.json`) and ESLint on the four
fleet-preferences adapter/owner files passed with Node24 on PATH. Focused tests:
`node --import tsx --test apps/tmux-gpui/bridge/fleet-preferences-owner.test.ts apps/tmux-gpui/bridge/fleet-preferences.test.ts`.
The initial adapter-only slice needed no Rust or native build; integrated controls
require the separate native gates described below.

## Existing resource and storage qualification

A separate private-directory test exercised the actual Hono resource handler,
owner authentication and existing load/updateFleetClientState disk implementation
through a real loopback HTTP server. Explicit favorites/collapse survived adapter
recreation; writes through the shared storage reducer appeared after refresh;
stale generation returned409 without changing bytes; malformed storage survived
a failed POST and GET unchanged. The owned server and temporary directory were
cleaned up. Test passed1/1. No personal daemon discovery or tmux session occurred.
This strengthens persistence evidence but is not a launched full-daemon/native
control acceptance check. Preserved script paths are relative to its original
.tasks/gpui-fleet-persistence location; the .txt copy is evidence, not a runner.

## Integrated bridge verification

Final bridge gate passed 456 tests with 5 optional skips and zero failures; the
gate includes TypeScript checking. Eight changed integration files passed ESLint
and independent review against `integration-source-freeze.json`. A reproduced
owner-replacement-during-write failure is preserved in
`write-replacement-before.log`; the regression now passes in the full gate.

The publication epoch rotates together with opaque action capabilities, separately
from the acknowledged adapter revision. Native queued controls also track presence
acknowledgement so refused background actions cannot strand the controls. Preference
reprioritization that displaces a selected machine from the bounded catalog now
refreshes the cached Home roster and publishes the reset filter without restarting
the global observer.

The final standalone bridge bundle built successfully. All three payload lengths
and SHA-256 hashes were checked against `integrated-bridge-manifest.json`. This
proves bundle construction, not the native runtime or clean-machine installation.

Independent native review found the broad icon-mask test still expected 47 assets
after adding two stars; the full default gate reproduced that mismatch (157 actual versus 155 expected).
Only the fixed-asset count changed from 47 to 49; all rendering assertions remain.
The exact icon-mask test then passed. Before/after logs are preserved. Full Rust
workspace qualification passed: 2,945 default tests (10 opt-in ignored) and
2,979 all-feature tests (17 opt-in ignored), zero failures. Formatting, file-size
and both all-feature/no-default-feature Clippy checks passed. The reviewed
13-file native source freeze is preserved in `native-source-freeze.json`. Physical qualification is described below.

## Physical native Home qualification

The optimized binary SHA-256 is
`a0cf65fe707a718b98e20052427de2980ceb5feccf1ad345f9ef18a67ed0eeb2`.
The supported local build wrapper and app assembly passed. The receipt binds
the source and binary; it is a cached local build, not a hermetic build claim.

The first isolated launch stayed at Loading sessions and emitted only appearance
and inactive presence. Automation could read its window but a click returned
noWindowsAvailable. The process remained live; it was cancelled by exact harness
PID, and the child was confirmed absent. Its receipt reports failure (cleanup
shares the overall failure flag); no writes or input occurred. This foreground/
activation failure is unresolved, not dismissed by the subsequent pass.

An identical second launch became active after AX Raise. At the observed
2000x1300-pixel window, actual native clicks filled the first duplicate-labelled
session's star, collapsed its machine while retaining only the favorite, then
expanded it to show both sessions. The first star stayed filled and the second
remained outlined. Screenshots were inspected inline, not saved as artifacts.
Cmd-Q exited normally. `native-visual-pass.json` records the exact first-session
favorite and group collapse/expand writes through the real authenticated route
and private store, zero terminal/routing commands, exit0 and successful cleanup.
The owned child was independently confirmed absent.

This fixture uses synthetic fleet publications, not a canonical daemon or real
tmux sessions. Full TUI/native reload, narrow physical layout, and resolving the
first-launch activation stall remain open. No production sessions, personal daemon,
remote services or existing user previews were altered.

Committed text logs have trailing whitespace normalized; original local logs remain in /tmp.
