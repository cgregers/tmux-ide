# Session sidebar keyboard navigation — branch validation

Local Ctrl-G sidebar focus/navigation is validated on this branch and not released.
Native qualification remains open; this covers session rows, not full fleet-tree parity.
An adversarial headless test updates browser_request while a sidebar row is
focused, redraws, and presses Enter. The draft implementation retired sidebar
focus without interrupting terminal input. The exact trace contains viewport
Resize request8/pane-a followed by Key Enter request8/pane-a. The diagnostic suite
passed 10 tests and failed that scenario. This direct state mutation does not
establish an existing production request-transition defect: normal select()
already clears input authority. It demonstrates an unsafe retirement path in
the new keyboard owner, which now interrupts before restoring terminal focus.

The same after-redraw path is retained in the fixed test; expected viewport
resize is checked explicitly, while terminal keys/session dispatch are refused.
A separate hidden-sidebar test accounts for its existing layout resize, then
checks Ctrl-G adds no terminal command. Explicit Escape preserves the existing
interruption latch. First Down with no selected row and held movement are also
covered, along with Cmd-K navigation preservation.

Fixed focused tests passed 12/12. Independent final source review approved.
Full Rust gates passed: formatting, size, both Clippy configurations, 2937 default
and 2971 all-feature workspace test successes (including doctests). The first
Clippy run found a collapsible-if style issue; a mechanical let-chain repair passed
the final gates without suppression. Optimized build passed after holding Git fixed; an earlier attempt correctly
rejected a concurrent commit. Native qualification remains pending. Initial
compiler/test failures are preserved. Logs strip trailing whitespace only;
raw copies remain in /tmp. Existing user sessions and alpha are unchanged.

The first synthetic native Workspace attempt stayed on Home Loading. Only
appearance and inactive-presence commands were observed, with empty stderr.
A subsequent CUA interaction returned noWindowsAvailable although the owned
child remained live. The exact harness was cancelled and cleaned up; its
failed receipt is preserved. This is not a sidebar pass or a demonstrated
product failure. The fixture startup sequence is under investigation.

## Native synthetic Workspace check

The same fixture passed on a fresh launch after explicitly raising its native
window through Accessibility. No source or fixture change was needed between
these two launches. At the observed 2000x1300 backing-pixel window, Ctrl-G and
Down drew a focus ring around the second duplicate label; Enter dispatched
session-b then pane-session-b and highlighted the second row. Ctrl-G/End
revealed and outlined row 40. Cmd-K opened the existing picker from sidebar
focus; Escape dismissed it, and Ctrl-G/Escape removed sidebar focus.

The final command receipt contains only appearance, presence, two viewport
resizes and exact session/pane selection. No terminal keys, text, paste or
scroll were emitted. Cmd-Q exited 0, owned process 16737 was confirmed absent,
and fixture cleanup completed. This is native UI with synthetic publications,
not a live-daemon integration proof. Screenshots were inspected inline, not
saved as image files. Two edge-drag attempts did not change window dimensions;
physical narrow-window verification remains open, as do OS composition and
complete machine/server/agent tree parity. The existing user alpha archive
was not replaced. The isolated QA app is closed.
