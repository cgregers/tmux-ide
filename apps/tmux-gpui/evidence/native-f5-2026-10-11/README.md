# Initial native F5 commands — 11 October 2026

Scope: searchable Home, Switch session, Appearance and Refresh using existing
picker and action owners. Full TUI command vocabulary, centered menu design,
Home search/filters and machine dialogs remain unfinished.

- 131 focused tmux_snapshot tests passed, including real headless F5 input/search,
  Escape, menu transition and rejection after browser request replacement.
- Workspace all-target/all-feature Clippy passed.
- Independent read-only review: no blockers in input ownership or dispatch.
- Physical macOS QA: F5 opens on Home and with a focused live terminal; searching
  Switch opens session picker, Enter selects an isolated live session; searching
  Appearance opens theme picker; Escape dismisses; light/dark menus render.
- Screenshots show isolated fixture content only. Shell prompts remain unchanged
  during command search; automated channel assertions verify no terminal input.
- Disposable QA bundle used a debug binary, SHA-256
  `19f9dd73a887651c3537e570f45121172f854a4d79fb89c493dc0c5d48f959c4`.
  It reused packaged bridge resources; its old release receipt does not qualify
  this binary as a release. No performance claims. QA app closed and its exact
  fixture controller exited successfully; user Polished Preview left running.
- Physical narrow window, IME and full palette vocabulary acceptance remain open.

The broader workspace run found a stale icon count in the preceding shared-icon
slice: all155 masks rendered but the assertion expected154. Updated fixed-icon
count46 to47 for the registered Home SVG. Failed evidence is preserved.
`just` was unavailable; Cargo and file-size commands were run directly.

Default-feature workspace tests passed after the count correction (including
2546 herdr-gpui library tests, 7 intentionally ignored external-resource tests).
Formatting and source-file size checks passed.

All-feature workspace tests also passed (2577 herdr-gpui library tests, 8
intentionally ignored tests). Existing opt-in native/platform tests remain unrun.

No-default-feature workspace all-target Clippy passed. An initial invocation used
a mistyped Cargo cache directory; it was cancelled and rerun with the correct
CARGO_HOME. No source or dependency versions changed during that correction.
