# First private activation experiment

The preserved first.ndjson contains two accepted request-0 mailbox states and a root mouse-down at elapsed 558256 ms. That mouse event reported window_active=false, presence_active=false, presence_ready=false, presence_revision=1. No activation callback stages 2/3 occurred in this trace. The recorded event reports dropped=0.

This demonstrates native input delivery while GPUI reported the window inactive. It does not establish a daemon/wire stale-state failure, nor prove why the macOS key-window transition did not occur. No forced activation or routing fix is justified by this observation alone.

Parent cancelled the exact harness: terminal exit 1 on cancellation; parent verified PIDs 55085/55097 absent. Receipt cleanup:false is derived from all errors (including cancellation), not a distinct cleanup failure. No Child/Server/Storage cleanup errors were reported. This is not an automatic overall cleanup-success claim.

After verifying every current instrumentation hash and saved baseline hash, the three tracked Rust files were restored byte-for-byte and the new trace module removed from product source. Its exact contents are preserved in experiment.patch. The private .tasks/gpui-activation-trace directory additionally retains activation_trace.rs, the before/ baseline copies, and experimental binary; those private files are not included in this evidence directory. bin/cli.js was not touched.
