# Native direct agent admission qualification

Source: c8c1efca, clean current-source native build. Separate disposable app,
isolated HOME/daemon/tmux socket, two sessions with two panes each. Existing user
demos and personal sessions were untouched. Controller and owned fixture exited
with code 0 and cleaned up after qualification.

1. Raised the actual QA window using its accessibility Raise action. Home showed
   the live four-agent fleet; neither session had been manually opened.
2. Enter on the selected Home blocked agent opened Native playground's second
   pane. Typed `printf GPUI_HOME_ADMISSION_OK`, then Return, through native input.
3. F7 over that workspace showed both same-label agents with session context.
   Down/Return chose Terminal lab's blocked agent in its unopened session.
4. The vertical terminal layout opened with its second pane selected. Pasted
   `printf GPUI_F7_ADMISSION_OK`, then Return, through native input.
5. Direct capture of all four private tmux panes confirmed each marker occurred
   only in its intended physical pane; neither sibling received either marker.
   See pane-input-proof.json and the three screenshots. Screenshots show actual
   command output and keyboard-ready state on the normal build.

The initial screenshot appeared stuck on loading. Exact captured wire replay
passed Rust Reader (76 lines, four live rows); temporary logging confirmed native
state application. Explicitly raising the actual window exposed the live UI.
No decoder relaxation or speculative native fix was made. Logging/test diagnostics
were removed, native rebuilt, and the successful physical path above rerun.
The private raw trace had an 8MB cap and is not a complete input-ready history:
final evidence uses native screenshots plus independent tmux marker captures.

The maintained full bridge gate (including scripts tests) passed 336 tests with
5 optional skips, 341 cases total. This supersedes the narrower top-level count
recorded in the previous increment. Native debug build passed. No Rust product
source changed, so existing full Rust regression qualification remains separate.

Limits: normal-size system-light local qualification only. Narrow/dark/IME and
remote fleet acceptance remain open. No release, packaging approval or full parity
claim. Next bounded Home workflow: observation Retry and Load more through the
shared observer owner; machine filtering needs exact identity before row truncation.
