# Reliability foundation — 12 October 2026

This increment sets up failure reporting and bounded lifecycle qualification. It does not resolve the currently failing Sfora terminal or establish TUI reliability parity.

Fixed allowlisted diagnostic codes preserve publication-limit, replica-validation, transport closed/error, runtime and startup categories. Only numeric close codes are retained; arbitrary error messages, terminal content, credentials and URLs are rejected. Browser previously discarded helper stderr. It now consumes a bounded strict diagnostic channel and preserves the first fault through child retirement. A fatal latch rejects buffered stdout so a failed child cannot restore Keyboard ready/input readiness. Independent producer and browser/channel reviews approved; a real-child stream-order test covers the latch boundary, not complete GUI navigation.

The new bundle reproduced real Spark Sfora selection: initial snapshot/Keyboard ready followed by Terminal state validation failed within one second. The diagnostic code is replica-validation. The source of that validation failure still requires investigation. The accompanying ad-hoc trace exits normally after its timer despite recording losses; its exit status is not a pass oracle. No terminal input, tmux destruction or daemon restart was performed in this increment. No real terminal content was stored.

Maintained browser-lifecycle-probe supplies an explicit stable-duration oracle, fails on post-ready loss/early exit, defaults to owned isolated fixtures and requires exact IDs plus explicit opt-in for real-host observation. Inactive presence avoids requesting input authority. It is bridge qualification, not physical GUI or network heartbeat proof. Repeated switching, resizing under output and reconnect recovery are follow-on acceptance work.

Morning briefing: https://www.sfora.ai/org/wavyr/posts/nh772zvahqdz15c81xpahkhand8g5rms
Branch work only; no merge, release, signing or replacement of the user's current demo in this increment.

Validation: full bridge/TypeScript gate passed 410 tests with five optional skips. A subsequent probe-only stdout-EOF regression is covered by six passing focused probe tests; scoped lint passed. This distinguishes the final extra check from the full gate count.
