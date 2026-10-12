# Native same-app recovery — 12 October 2026

Source baseline: f180c5da with the reviewed native-recovery-smoke.mjs change in this commit. Exact artifacts are in artifacts.json. Unsigned development app, isolated HOME/cwd/PATH, private CLI, pinned tmux, one disposable session. Production Spark daemon and user Compact Preview were not restarted or modified.

## Physical journey

CUA operated the actual macOS native QA window:

1. Opened the disposable session from Home and clicked its terminal.
2. Typed `echo BEFORE_REPLACEMENT` and Return. The fixture required the standalone output marker from its exact owned pane.
3. Fixture stopped only its owned daemon. Observed the native terminal clear and show `Terminal connection closed (code 1001)` before creating the recovery signal.
4. Fixture started a replacement daemon. Clicked native Refresh and selected the original session, in the same app process.
5. Original terminal output reappeared. Typed `echo AFTER_REPLACEMENT` and Return; both standalone markers were visibly present and the fixture verified the new output.
6. Quit QA with Cmd-Q. Fixture verified original pane ID/PID and contents survived app exit, then cleaned up its owned resources and exited 0.

`result.json` is the final post-cleanup result. `physical.log` preserves the full short run output, including a transient host-configuration warning during recovery; successful recovery does not establish that warning as harmless. No screenshots were saved for this run.

## Harness safety and review

Private CLI override avoids rebuilding protected bin/cli.js. Ambient daemon/tmux variables are scrubbed. Cancellation is latched across startup and UI waits; cleanup attempts app, daemon and fleet independently. A separate no-GUI cancellation control exited 1 and confirmed app/daemon stop and scratch deletion (`cancellation-control.json`). It is not a native UI proof.

Independent review approved script SHA c43e4d6f63f1c7d9bf19671211906ceecd0f5d88c2e14dd69237fc401f601c88. Syntax and diff checks passed; scoped lint passed before physical run. Protected bin/cli.js hash remained 9a788355148b0652da27c5e971cc917fcdbd83ec7ddb8176f1285b19a0b54ece.

## Limits

This proves native selection, keyboard input, visible disconnect, explicit same-app Refresh recovery, and source survival on this fixture. It does not qualify paste/IME, pointer resizing, native scrolling/copy, long-running real-host stability, signed installation, or public release. Source survival here checks pane ID/PID and capture, not OS process birth-time identity. The unavailable-state observation is an operator/CUA assertion, not an automated pixel oracle.
