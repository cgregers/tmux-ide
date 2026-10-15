# F6 shared popover and Home keyboard selection

F6 and Command-K now reuse the F5 popover over the unchanged Home/Workspace.
Navigation keeps exact IDs and request fences, including duplicate labels.
Theme remains sidebar-based and machine dialogs retain their existing owners.

Home agent rows now support arrows, Page Up/Down, Home/End and Enter with opaque
selected keys. Selection reconciles after filtering/removal, skips unavailable
rows and reveals explicit navigation. Unrelated publications preserve manual
scroll offset. Enter requires the displayed key and roster revision to remain
current; removal before redraw cannot activate an unseen replacement. Search
composition, Home/End editing, modifiers and modal ownership remain isolated.

## Evidence

- Independent source review approved F6 and Home changes after two findings were
  fixed: unseen replacement activation and unrelated updates resetting scroll.
- Focused tmux_snapshot tests: 176 passed before test-only topic extraction.
- Default workspace: 2856 passed / 10 ignored. All features: 2890 passed / 17
  ignored. Both Clippy configurations, formatting and source-size checks passed.
  The unchanged block 0.1.6 future-compatibility warning remains.
- Native debug executable built and ran against the private candidate daemon
  containing the startup-delivery correction (90606cf5), with private HOME/socket.
- Physical F6 over Home and live vertical two-pane Workspace: search selected
  Terminal lab; terminal became keyboard-ready; paste stayed in search and was
  absent from all four owned tmux panes; outside click over another session
  dismissed without navigation. Opening/search/dismiss left real pane dimensions
  byte-identical (native-checks.json).
- Native window resized from 1000 to 640 logical pixels with F6 open. Popover
  remained within bounds, with readable labels in light and dark themes. Narrow
  Home and Workspace screenshots are retained. Escape and Home/F6 routing worked.
- QA window was closed; controller exited 0 and scratch root was removed.
  Existing user demos were untouched.

## Remaining acceptance

The live fixture had no observed agents, so real-agent Home selection and nested
scroll feel remain unqualified physically. The keyboard/roster/IME guards have
headless coverage; no new OS IME proof is claimed. No performance, remote SSH,
packaging/install or release claim. F7 still requires scoped fleet-wide attention
observation and action admission over Workspace; selected-session or cached Home
data is not a substitute. See TUI-PARITY.md.
