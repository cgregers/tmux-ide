# Retained empty tmux server catalog

A live tmux server with exit-empty disabled and zero sessions passes identity probing,
but list-panes -a fails with no current target. Owner startup previously rejected
that server as offline. The catalog now uses one server-side conditional under the
existing generation fence and no-start flag. Only its explicit successful empty
marker admits empty membership; command errors, malformed and blank output remain
failures. Reconciliation removes volatile entries only, preserving durable intent.

Before: one focused unit failure and actual empty-owner startup failure.
After: 16 focused tests, real empty → first session → catalog test, daemon
typecheck and ESLint pass. A test-only cleanup correction preserves original and
cleanup errors and the same live test passes afterward. This is isolated local
macOS verification, not remote/platform or native physical interaction acceptance.
The fleet-server-navigation evidence records the separate full bridge workflow.
