# Native TUI status and pane-header parity

Agent presentation uses the TUI's state vocabulary and marker sequence in Home,
the workspace roster and uniquely matched pane headers. Unavailable/disconnected
observations override routine activity; failed and attention states have semantic
colors. One 80 ms presentation clock animates painted working indicators only.
Hidden, inactive, modal and non-working states do not keep requesting frames.
No terminal output, process liveness or input authority is used to infer activity.

Top and protected lower pane headers now expose their own overflow controls.
The contextual menu contains Rename, Zoom/Restore, Split right/down and Close;
Close retains confirmation. An unselected header first selects its exact pane,
then opens only after fresh scoped action capability arrives. Navigation,
backgrounding and competing modals retire the pending intent. Stale global F5
callbacks cannot execute in the replacement pane-only menu. The footer action
button was removed. Remaining separator area continues to serve divider dragging.

The selected pane exposes Back to live before Restore when history is active.
The helper's validated offset is published explicitly and defaults to zero for
older publications. Rust rejects malformed, oversized or authority-inconsistent
offsets. The real isolated browser journey verified history, input suppression,
return to live and exact input delivery, clearing history on Home navigation,
original pane identity preservation and cleanup with an explicit private CLI.

Independent source review is retained beside failed and passing evidence. The
first focused runs found test compile issues; Clippy then caught a module-path
mistake that loaded the wrong controls module. The final default workspace gate includes and passes
`narrow_headers_reserve_only_controls_that_fit_and_never_overlap_pane_cells`.
The earlier 235-test result is not evidence for that particular topic test.

Native reduced-motion preference wiring remains pending; a static indicator API
exists. This source change is not signed/released packaging or a claim of full
TUI/platform parity. Existing user demos were not replaced by the work.


Final qualification on the compact-menu source:

- Default workspace: 2,915 passed, 0 failed, 10 explicitly ignored.
- Both all-feature and no-default-feature Clippy configurations passed.
- Bridge checks: 390 passed, 5 explicit skips; scoped ESLint and TypeScript passed.
- Pane-only popover is capped at 360×240; global picker remains 560×400.
  Rendered tests cover normal and narrow viewport sizes.
- First final all-feature compilation exhausted space on the external Cargo
  target disk. Only its regenerable debug/incremental cache was removed before
  rerunning. The failed compiler output is retained separately.

Physical native QA used an isolated synthetic browser publication fixture, not
production sessions or a real agent harness. Top and lower header menu clicks,
exact lower-pane selection, sidebar toggle, status colors and changing spinner
frames were observed. The initial fixture used a mismatched request number;
correcting the fixture to the native initial request made the published UI appear.
Its fixed-size grid may clip rightmost controls with the sidebar visible; this
fixture does not answer viewport resize requests. No real-daemon native GUI or
signed/package release claim follows from this inspection.

- Final recovered all-feature workspace: 2,949 passed, 0 failed, 17 explicitly ignored.
- Final formatting and file-size gates passed.

Final rebuilt debug binary passed visual inspection: compact lower-pane menu
selected Verification and showed only its five pane actions; Home showed the
working spinner and needs-input marker. Screenshots are synthetic native UI,
not terminal-output or real-harness evidence. Owned QA window was closed after
inspection; user demos were untouched. Light theme and physical narrow-window
inspection remain unqualified in this slice.
