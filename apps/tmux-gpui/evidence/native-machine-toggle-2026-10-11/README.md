# Native saved-machine enable/disable — pending full qualification

Uncommitted work on codex/tmux-gpui-bootstrap after cd599405. F5 Manage saved
machines uses a separate searchable modal list with explicit Enable/Disable
rows. It sends the existing machines/mutate wire command with captured UUID and
registry revision. No optimistic registry update, terminal input, navigation or
remote session stop is performed. Availability, pending, revision and current
enabled state are rechecked by the native handler and canonical registry owner.

Independent read-only review approved this scope. The native queue is not a
one-shot mutation guarantee: rapid repeated Enter before a pending publication
may queue another request; the existing bridge pending/revision guards prevent
concurrent writes. No stronger claim is made.

Two focused tests pass: actual headless F5/search/Enter sends the exact disable
command and preserves the current state; model/serialization checks cover enable
and stale/pending/unavailable actions. These do not prove physical persistence.

Retained initial failure: test module name shadowed production saved_machines;
qualified the production module path. Initial Clippy exposed two expect calls
in the earlier captured fleet startup test; replaced them with propagated test
errors. Final workspace gates passed: default 2834 passed, 10 ignored; all features 2868 passed, 17 ignored. Both Clippy configurations, format and source-size checks passed.

The unresolved native Home Loading observation remains separate. Existing QA
and recording showcase processes were not restarted. Physical modal, narrow
layout, long-label, pointer and persistence qualification are still required.
