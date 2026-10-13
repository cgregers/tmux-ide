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
