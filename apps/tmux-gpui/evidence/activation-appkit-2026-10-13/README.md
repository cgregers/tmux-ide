# Native AppKit activation discrimination — 13 October 2026

Experimental binary `121651ae4396ba0674ee8ff469e5b3c91e1a6e17c209db9e39020a0750155df7`.
No product guard or activation behavior changed. Temporary instrumentation was
independently reviewed, passed289 focused tests and all-feature strict Clippy,
and built in release mode with integration-test. That narrower feature build
emitted the pre-existing unused themes import warning; it is not release-qualified.

In one owned process, Raise and two machine clicks arrived while both raw
NSApplication.isActive and NSWindow.isKeyWindow were false. GPUI cached activity
also was false. Presence revision1 was acknowledged, and only the not-ready
sidebar guard bit4 rejected both clicks. This rules out a stale GPUI active cache
or missing presence ACK for these captured clicks.

During the CUA Ctrl-G interval, AppKit and GPUI became active; the activation
callback updated presence, and publication ACK2 made it ready four milliseconds
later. Subsequent clicks expanded/collapsed the machine and keyboard navigation
selected exact second-server B. Parent visually observed the accepted second-server
window/pane before Cmd-Q, without restarting. Owned PID21599 exited0 and was
verified absent. Synthetic fixture only: no daemon, tmux or user sessions touched.

The evidence locates this reproduction before application activation. Ctrl-G's
handler does not activate the window; the tool's keyboard action coincided with
the OS activation. It does not establish why initial cx.activate(true) was not
honored, prove normal Finder/user clicks fail, or justify weakening guards.
Next qualification should use the normal packaged launch and actual user focus
behavior rather than treating AX Raise or delivered background clicks as proof
of foreground activity.

All emitted trace rows report dropped0, but the final stage11 flush marker is
absent despite clean process exit. Consequently full shutdown capture is NOT
verified. Conclusions above rely only on present timestamped samples correlated
with operator-actions.json and fixture receipt. The raw fixture visual flag is
false; visual inspection is recorded here separately. Screenshots were inspected
inline, not exported.

Original source was restored byte-for-byte against saved hashes and the temporary
module removed. Downloadable alpha09 is unchanged. Shared Cargo release output
now contains the experimental binary and MUST NOT be packaged as a qualified
release; use the existing alpha09 qualified artifact or rebuild with a fresh
release receipt. No signing, publishing, production mutation or full parity claim.
