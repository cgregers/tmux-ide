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
the final gates without suppression. Optimized build and native qualification
remain pending. Initial
compiler/test failures are preserved. Logs strip trailing whitespace only;
raw copies remain in /tmp. Existing user sessions and alpha are unchanged.
