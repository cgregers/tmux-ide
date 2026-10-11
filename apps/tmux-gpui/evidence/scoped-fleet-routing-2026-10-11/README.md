# Scoped fleet routing and ordinary-session selection

The new native fleet adapter incorrectly required workspaceName before a session
could be selected. Ordinary tmux sessions legitimately lack this before the
existing catalog.panes → daemon openSession path promotes them. Removed this
presentation restriction; live session ID and server scope remain mandatory.

The new configless regression fails against committed e55e6c1d (null selection)
and passes against the fix. Baseline module/test ran from temporary sibling
copies, removed afterward; the live recording demo was not used or changed.
The test also retires the selection when the server generation changes.

Local discovery and remote route construction now accept optional exact server
scope. They validate/copy it before awaiting identity, require that ID+generation
to be online, and retain the prior single-online-server requirement when scope is
omitted. Missing, offline, restarted or duplicate registrations never fall back.
Private SSH host files accept scope; switching only scope retains the SSH owner.
Local editor provenance and remote identity verification remain unchanged.

Independent read-only review approved exact-generation matching, identity fences,
configless promotion and transport reuse; the reviewer did not run UI or tests.

Final bridge TypeScript/tests: 311 passed, five skipped. Focused ESLint,
Prettier and diff checks passed. No Rust changes. Initial test failures were
fixture mistakes: an offline registration must have null generation, and duplicate
registrations fail the shared schema before reaching scope selection. Both failed
logs are retained; corrected tests accept the appropriate rejection layer.

Browser fleet publication/Rust protocol and grouped Home/F5 UI remain pending.
This qualifies controlled route construction, not real SSH or physical multi-server
interaction. No card closed and no release or production session mutation.
