# Explicit fleet-server navigation — qualification in progress

The uncommitted bridge/native slice publishes bounded machine/server/session
hierarchy, including empty/offline servers, and selects a server through an opaque
exact route. Home shows the session-creation destination. Session rows whose
server metadata is omitted remain navigable; creation requires a published exact
destination. No default-server fallback is allowed.

Final bridge gate: 354 passed, 5 optional skips; typecheck passed. Native focused:
207 passed; default/all-feature workspace tests passed. Both Clippy configurations,
format, source-size and debug build passed. One mechanical boolean simplification
followed the tests; exact source review approved it. Initial Clippy failure is
preserved. Reviews and manifests identify scope; native tests do not verify the
new live server workflow. Logs normalize trailing whitespace only.

The maintained fleet-server-smoke.mjs creates two genuinely empty private retained
tmux servers with duplicate labels, beside one protected source server. Its first
run failed: registering an empty server returned offline before navigation began.
Cleanup ran and the original failure is in live-before.log. Daemon fix 2d889407
handles witnessed zero-session catalog results under the existing generation fence.
The next run reached creation but exposed a fixture naming assumption: a display
name is not the generated native session name. That failure is preserved separately.
The corrected fixture observes the supported scoped creation receipt and matches
its display name, generation and live identity against the exact catalog, browser
choice and actual socket session name.

Final same-path live run passed with two genuinely empty duplicate-label servers:
second selected by identity, exactly one session created there, first still empty,
source identity/geometry/stamps unchanged, and owned cleanup complete. Exact private
CLI and fixture hashes are in live-build.json. Bridge/native source reviews and
manifests remain valid. Native physical checks remain unqualified. No card closure,
merge or release. The user's existing demo was left untouched.
