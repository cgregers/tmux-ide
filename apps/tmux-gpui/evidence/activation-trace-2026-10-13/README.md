# Native activation diagnostic, 2026-10-13

This was a private synthetic fleet fixture using the real authenticated preference
route and storage, with no canonical daemon, tmux socket, or terminal routing.
The instrumented binary was experimental and is not a release artifact.

`first.ndjson` records a delivered root mouse-down at 558256 ms while both actual
GPUI window activity and published presence were false. No activation callback
was observed; no preference write occurred. This narrows the investigation to
native activation/foreground admission, but does not identify its cause or prove
an issue in the daemon. AX focus and a visible window did not establish GPUI
key-window activity. The foreground guard remains unchanged.

Trace stages: 0 initialize, 1 construct, 2/3 activity callback before/after,
4/5 startup activation before/after, 6 changed render, 7 captured mouse-down,
8 accepted mailbox, 9 ignored request, 10 unavailable, 11 finish. Records contain
only bounded diagnostic counters and booleans. See `experiment.patch` for exact
instrumentation and `freeze.json` for source hashes.

The operator cancelled the failed run. `cancelled-fixture.json` is a failed
receipt, not a passing acceptance test. Its cleanup flag includes cancellation;
no distinct cleanup error was reported, and both exact owned process IDs were
verified absent. A clean-exit trace was not captured.

Instrumentation was independently reviewed; 265 focused tests and all-feature
Clippy passed, and the private release-mode build exited zero. These checks do
not qualify a release or resolve the activation failure. The original product
source was restored by exact hash after the experiment. The previous qualified
Fleet Preferences QA app was not modified. The shared Cargo release output now
contains the experimental binary and must not be packaged as a qualified build.
