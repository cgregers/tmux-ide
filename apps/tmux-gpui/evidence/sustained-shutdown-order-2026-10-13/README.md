# Sustained output: controlled shutdown diagnostics

Linux CI 38354278833 reached the post-flood owned-daemon stop and failed because
stderr contained the legitimate source-closed diagnostic instead of an empty
string. The same local full path failed before the oracle correction, with
transport-closed/1001 instead. Both are controlled shutdown outcomes:
TerminalDeliveryHub.close() first calls resetForSessionRestart(), which enqueues
source-closed; WebSocket shutdown can instead win the first-diagnostic race.

The fixture now requires empty stderr before stopping its daemon. After the stop,
exactly one strict source-closed or transport-closed/1001 diagnostic must match
the visible status, with a newer publication, null snapshot and disabled input.
The same diagnostic must be the only stderr output through cleanup. No runtime
code, limits, timeout or flood/input oracle changed. Optional validated private
CLI startup avoids rebuilding or touching bin/cli.js. Explicit Node imports only
address scoped lint globals.

Local source failed before and passed after using Node24, pinned tmux and the
same private CLI. See logs and frozen hashes. The 2000-line/200-tick producer,
distinct intermediate progress, exact final text cells versus tmux capture,
post-flood input and cleared disconnect assertions are retained. No GUI, forced
backpressure, RSS or GPU qualification is claimed. Hosted rerun remains pending.

Neighbor audit: history, multipane, live and window-canvas fixtures check cleared
state after owned stop without demanding empty stderr; Home/workspace-agent and
session-create empty-stderr assertions precede cleanup. No other exact same
post-stop-empty assertion was identified; none was edited.

```sh
PATH=/private/tmp/gpui-split-promoted-eg12r6nf/bundle:/private/tmp/tmux-ide-295-release-nkydyctm/bin:$PATH TMUX_GPUI_TEST_CLI="$PWD/.tasks/gpui-new-window-fixed/cli.mjs" node --import tsx apps/tmux-gpui/bridge/sustained-output-smoke.mjs
pnpm exec eslint apps/tmux-gpui/bridge/sustained-output-smoke.mjs
pnpm exec prettier --check apps/tmux-gpui/bridge/sustained-output-smoke.mjs
```

Exact branded package headless run also passed using bundled Node/browser/live
from `.tasks/gpui-branded-alpha-2026-10-13/Tmux IDE Preview.app` with
`TMUX_GPUI_TEST_APP` set to its absolute path. Artifact hashes are in freeze.json.
Both source and package runs observed 200 intermediate progress advances and
transport-closed/1001 after the controlled stop. No native UI was launched.

Final review tightened the sequence check to positively require a newer sequence,
rejecting absent/non-numeric values. The final source full-path rerun passed
(`source-sequence-final.log`); lint/diff checks passed. The package run predates
only this stricter fixture guard; both fixture hashes are recorded.
