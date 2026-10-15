# Native F5 popover and shared controls

F5 Commands now floats above Home/Workspace using Herdr-style occlusion, themed
surface/border/shadow and existing search/input owners. Opening does not replace
the sidebar or resize terminal geometry. Outside click and Escape dismiss;
unavailable commands remain visible but inert with dispatch-time revalidation.
Navigation/theme pickers remain sidebar-based; F6/F7 convergence is a later
explicit parity item. Shared controls retain 32px height, 16px SVGs and stable tab
widths, with 12px labels, semantic colors and Herdr's corner token.

## Validation

- Rust workspace default: 2849 passed / 10 ignored.
- Rust workspace all features: 2883 passed / 17 ignored.
- Formatting, source-size, native debug build and both all-feature and no-default-feature Clippy passed.
- Five new tests cover rendered control bounds, Home/workspace geometry, disabled
  commands, keyboard routing, outside down/redraw/up and composition isolation.
- Independent review approved scope. Initial test-authoring errors (non-selector
  Home ID; assumption that OS-simulated keys retain marked composition) were fixed
  without changing product behavior; full final gates passed.
- Physical QA on a unique private-HOME/daemon/tmux socket: light Home + light/dark
  Workspace popovers; search/Return opened Appearance; Escape and outside click
  dismissed; clicking above another session did not switch it. Wheel over popup
  left visible terminal content unchanged. Pasted marker stayed in search and was
  absent from every owned tmux pane. Actual pane geometry stayed byte-identical.
  Screenshots and native-checks.json retain those narrow observations.
- QA controller exited and scratch root was removed. A read-only window relaunched
  by the automation observation after close was terminated by its exact PID.
  User Home Fleet and Showcase demos were never touched.

## Open verification and separate failure

Physical narrow resizing attempts did not resize the OS window; only the 520px
headless layout test proves narrow coverage here. Actual OS IME and all themes
remain unqualified. These are not full TUI parity or release claims.

Two initial live preflights selected the lexically first long-name vertically
split session and failed to reach input readiness (Pane unavailable, null
snapshot). Shortening that other session's name selected the horizontal playground
instead and passed. This is a different target, not proof of a fix. Failed logs
are retained here; diagnostic publications and bounded isolation experiments are
in .tasks/gpui-f5-popover-qa and .tasks/gpui-fleet-input-triage. The cause remains
under investigation. Do not erase that blocker with the passing UI checks.

Subsequent isolated controls passed for quiet long/short vertical and long
horizontal sessions. Adding the original output producer reproduced failure with
both long and short vertical session names. Numeric-only diagnostics observed
chunk index 2 while the replica expected 0 in a three-chunk transaction. Session
naming is therefore not the cause; delivery ordering/completeness remains under
investigation. No product fix for this separate failure is claimed here.
