# Native saved-machine editing

F5 Manage machines now exposes a two-field Edit dialog using the existing
canonical local registry API. Only label and SSH target are sent: UUID, enabled
state and pinned environment identity remain unchanged. Captured request,
revision, full original profile, foreground presence and fresh dialog identity
fence Save/Cancel. A submitted latch rejects duplicate writes. Unchanged forms
queue nothing; success requires a newer settled matching publication without an
error. Uncertain results are not replayed. Registry revision is local preflight,
not daemon-side atomic compare-and-swap across the asynchronous request.

Native tests exercise typing, Tab, Enter, hidden-list arrow isolation, a 640x400
bounded scrollable dialog, unchanged-form refusal, stale revision/reopened
identity, queue saturation and marked-composition isolation. Rendered selectors
verify pre-ACK, old-revision and errored publication remain unconfirmed; a newer
matching settled publication confirms. These are headless GPUI events, not OS
pointer/IME or visual polish qualification.

The existing browser/canonical HTTP handler process fixture is parameterized for
Remove and Edit. Two disabled profiles with environment pins live in private
files; no SSH is initiated. Exact edited UUID/fields, unchanged pin/enabled/sibling,
stale/background/request/pending duplicate refusal and final publication/file
are checked. No production bridge changes were needed.

Validation: 216 native focused, 2896 workspace and 2930 all-feature tests passed
(10/17 existing workspace ignores). Both Clippy configurations, fmt, source size
and debug executable build passed. Bridge gate: 360 passed, five existing skips;
focused process tests, typecheck and lint passed. Independent review and exact
source hashes attached. First compile failed because Theme was moved into two
input closures; clone corrected ownership. First bridge assertion compared JSON
key ordering; deep structural equality corrected the fixture. Failed and passing
logs are preserved. A focused rerun after final author freeze ensures the final
keyboard routing change was compiled and tested.

New native binary is not yet assembled into a qualified app or physically tested.
Real SSH, native pointer/IME, signed distribution, clean-machine install/update
and public preview release remain open. User-controlled demo, production sessions
and protected bin/cli.js were untouched. No merge or release.
