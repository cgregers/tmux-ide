# Home agent filters — 11 October 2026

Adds bounded agent name/session-label search and All/Working/Needs attention.
Session cards and full roster coverage stay visible. Matching uses published
status/attention, while opening uses the existing opaque key and revision fences.
Unavailable retained rows never gain activation through filtering.

Validation:
- 134 focused tmux_snapshot tests passed, including search input isolation,
  combined filters, unavailable statuses and existing stale row identity tests.
- Default workspace test run passed; all-target/all-feature Clippy passed.
- Independent review identified a deferred AppKit composition owner defect for
  Home search. The saved regression failed before the owner fix and passed after.
  The deferred task now excludes Home; Workspace terminal cleanup remains enabled.
  This is a headless ownership regression, not physical OS IME qualification.
- Native macOS light/dark checks with an explicitly scoped disposable daemon:
  two published agents; All shows both, Working selects WORKING, attention selects
  BLOCKED; unmatched query shows No matching loaded agents; session card and
  observation coverage remain. Search survives F5 appearance change. Clicking the
  filtered agent emits its exact OpenAgent key/revision, followed by workspace resize.
  No terminal keystroke command was emitted by search. QA controller cleanup passed.
- Native debug SHA256:
  `a78d1f52e9a0413f3e9dac42549d83ff49ed2a70a788776dda49584fefe25042`.
  QA shell reused packaged bridge files; old release receipt is not certification
  of this binary. No release or performance claim.

QA caveats: initial loading screenshot updated after activating the native window;
no persistent loading failure reproduced. A --local fixture attempt discovered an
unexpected local catalog; it was closed without opening or modifying its sessions.
All acceptance screenshots and agent actions use the explicitly scoped disposable
session e2e-home-filter-qa-15573-0. User Polished Preview was left running.

Remaining: physical narrow layout, actual OS IME, Linux/Windows checks; Home machine
filter and broader team/project/machine search; keyboard status shortcuts and full
TUI palette/dialog parity. No full-parity checkbox is closed by this slice.

Both default and all-feature workspace test runs passed (2549/2580 native
library tests respectively; existing external-resource tests remain ignored).
Full logs retained under /tmp; summary and SHA256 recorded in workspace-results.txt.
Formatting and source-size checks passed. Only macOS Rust target is installed;
Linux/Windows qualification is pending.

No-default-feature workspace all-target Clippy also passed.
