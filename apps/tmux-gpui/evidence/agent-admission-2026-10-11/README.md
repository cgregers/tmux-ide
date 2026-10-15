# Targeted Home/F7 agent admission — 11 October 2026

Previously, discovered fleet agents could not be opened until their session was
opened separately. Promotion changes both the observed pane and agent IDs; see
../unpromoted-agent-2026-10-11 for the original raw before/after evidence.

## Change

An authenticated, server-generation-scoped POST admits the observed pane/agent
pair. The daemon captures the native session/window/pane/birth identity, promotes
through the existing serialized owner, rechecks that exact physical pane, and
returns its unique semantic pane ID. Existing ordinary session-open shape stays
unchanged. Both owner adapters detach caller input before asynchronous discovery.

Home and F7 offer this operation only for a current opaque fleet target. GPUI's
bridge accepts the daemon mapping, checks a fresh unique attachable shell row and
inventory, and selects only that pane. Existing bound/nonfleet handling is retained.
No label, index, first-pane fallback or automatic mutation retry was added.

## Evidence

- `live.log`: separate unopened two-pane private sessions for Home and F7. Both
  panes have the same display label; the blocked agent is the second pane.
  Observation did not stamp either pane. Direct agent selection selected the
  second physical pane's promoted ID, preserved both panes, and reached inputReady
  with a terminal snapshot. All owned fixture processes and roots cleaned up.
- `baseline-timeout.log`: pre-integration smoke could not reach an available row;
  this timeout is indirect evidence; the original diagnosis above preserves the
  actual unavailable row and identity transition.
- `fixture-stale-roster.log`: first draft attempted a click while presence handling
  refreshed Home. It correctly rejected the old roster. The final fixture waits
  for presenceRevision acknowledgement and a fresh live roster before clicking.
- Owner focused tests: 16 assertions across two Vitest projects. Existing session
  live tests: 14 across two projects. Owner snapshot live regression: 2 across two
  projects, including mutation of the caller's request after calling openAgent.
- Shared contract/client/mounted route: 2/3/2 tests passed. Bridge top-level TS
  suite: 206 passed; mjs suite: 28 passed, 5 optional skips. Typechecks and scoped
  lint passed; private CLI bundle built without changing protected bin/cli.js.
- Independent source review approved identity mapping and unchanged session-open
  behavior; request-aliasing finding fixed and rerun against real private tmux.

Run from repository root with Node 24 and qualified bundled tmux on PATH:

```sh
TMUX_GPUI_TEST_CLI=/absolute/private/cli.mjs node --import tsx apps/tmux-gpui/bridge/agent-admission-smoke.mjs
```

## Limits / remaining work

No native UI or physical keyboard test was performed in this increment. Existing
user demo windows were untouched. Positive pane_birth_id support is required;
stock tmux without it refuses targeted admission. An older daemon without the
endpoint fails without fallback. Cancellation suppresses late navigation but does
not undo a promotion already accepted by the daemon. The live trace briefly shows
"Pane unavailable" before keyboard-ready; truthful startup wording remains a UI
polish item. Full Home/fleet parity and packaging/release qualification remain open.
This is branch work, not merged or published.
