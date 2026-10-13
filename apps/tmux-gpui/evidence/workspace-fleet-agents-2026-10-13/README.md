# Workspace fleet agents: in-progress acceptance

Base commit: `87c44d25`. This directory records a development baseline, not final
approval, native GUI validation, a packaged release, or complete TUI parity.

The isolated source bridge / canonical daemon run completed with exit 0 on
13 October 2026. Its exact assertions are recorded in `real-daemon-baseline.log`.
Two sessions carried duplicate agent names. The fixture proved cross-session
publication, independence from F5 query/cancel, stale scope refusal retaining the
current terminal, admission to the exact second pane, selected-key publication,
unchanged source pane identities, and cleanup of owned resources. It sent no
terminal input. The bridge source hashes are in `bridge-baseline-freeze.json`.

Review subsequently required fresh incarnation validation for the selected row,
plus native keyboard-focus continuity and pending-navigation guards. This baseline
does not prove those repairs. Their regression and final acceptance results must
be recorded separately before approval.

The fixture is preserved verbatim as `real-daemon-fixture.mjs`; its relative
imports require running the original at `.tasks/gpui-workspace-fleet-agents-real/run.mjs`.
It requires an explicit isolated CLI through `TMUX_GPUI_TEST_CLI`, Node with tsx,
and the repository fixture toolchain. It never discovers a personal daemon.

## Final bridge repair

The final bridge source hashes match `bridge-final-freeze.json`. Independent
review approved the fresh target equality guard for selectedKey. Focused tests:
43 passed; full bridge gate: 503 passed, 5 optional skips (including typecheck);
scoped lint passed. The same real-daemon fixture reran after repair and exited 0;
`real-daemon-final.log` records the assertions. This remains source bridge proof,
not a native GUI or packaged test. Native fixes and acceptance remain pending.

## Native focused verification

Independent review approved the 28-file `native-final-freeze.json` and the parent
keyboard-reference text. `native-focus-before.log` reproduces lost focus after an
observation revision; `native-pending-before.log` reproduces competing old-origin
F5/F7 navigation. The fixes rebind only a still-actionable same-scope/key row at
redraw and block competing agent submissions during pending admission. Old
callbacks remain refused. Focused tests pass: 303, zero failures. Broad Rust gates
and native physical qualification are still pending; these unit tests do not prove
rendering or macOS input behavior.

## Broad native gates

All six local gates completed with exit 0: format, file size, strict all-feature
and no-default-feature Clippy, default tests (2,983 passed, 10 ignored), and
all-feature tests (3017 passed, 17 ignored).
Final native source hashes were rechecked after the run. Native visual and
package acceptance remain pending. Logs and command results are preserved here.
