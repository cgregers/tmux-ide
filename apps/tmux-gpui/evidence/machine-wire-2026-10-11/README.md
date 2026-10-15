# Native registry publication compatibility regression

Trigger: launch the source bridge from branch commit 910d5fc0 with a new native reader. That bridge always includes `machines`, initially null; its Rust decoder still denied this unknown field. No network or terminal feed failure was needed. The user's already-running older preview was unaffected.

Reproduction: captured initial and empty-registry publications from a browser process with private temporary HOME/XDG/TMPDIR and malformed private host config. Only the random connection ID was normalized. No personal daemon, credentials, terminal output or saved machines were read. Fed these exact fixtures through the production Rust Reader: failed with unknown field `machines`. See failing-decoder.log.

Fix: explicitly admit optional typed registry publications with strict nested fields and bounds. Retain unknown-field rejection globally. Reject malformed IDs/environment identity hints, duplicate IDs, control characters, oversized labels/targets/messages and registry cardinality; invalid frames do not consume sequence state. Registry data is not yet actionable in the native UI.

The isolated JavaScript process test now compares current producer field keys with the same checked-in fixtures decoded by Rust, linking both language gates. Rust accepts the original failed wire inputs after the change; focused native tests passed (140). A follow-up test refinement independently verifies 64 unique profiles accepted and 65 unique rejected. Default and all-feature workspace suites passed (native library 2555/2586 passed respectively; existing ignored tests remain). Both all-target Clippy configurations, formatting, source-size, TypeScript and changed-file ESLint passed; bridge gate 289 passed/five skipped. Independent reviewer approved the decoder and refined cardinality tests. Results are recorded alongside this report.

Limits: this proves the exact producer-to-decoder path and headless native handling, not a fresh physical app launch or real SSH. Native saved-machine controls and saved-route reconciliation remain pending. No release or full-parity claim.
