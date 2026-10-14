# F5 pane actions — 11 October 2026

Workspace F5 now offers Zoom/Unzoom pane, Split right and Split down using the
existing daemon-backed pane-action command and one-use captured capability. No
new bridge operation or alternate pane owner was introduced. Home omits these
rows; unavailable Workspace rows remain visible and inert.

Queue admission revalidates request, selected session, capability token and
acknowledged presence. An old F5 callback cannot dispatch after switching into
Theme, Navigation or Machine pickers, or while another modal owns interaction.
Successful queue admission consumes the capability; a full queue preserves it,
keeps the picker open and reports the failure. Terminal input interruption remains
set and is not implicitly rearmed by these actions.

## Evidence and limits

Independent review approved the final six source hashes in `source.json`, after
finding the missing picker-mode guard. The new regression exercises captured F5
callbacks after replacing the picker and asserts no commands/capability change.

The first focused run had 200 passes and one failure: the test initialized a
Workspace after drawing the default fixture and then received that first viewport
resize before its expected pane action. The corrected fixture establishes the
Workspace before initial draw. The final test still asserts the exact command,
no extra commands and unchanged canvas bounds; it does not discard resize messages
from the action phase. Final focused run: 202 passed. Both logs are retained.

Default and all-feature workspace tests passed. Both all-target Clippy feature
configurations, format/size checks and native debug build passed. Clippy's initial
failure and mechanical corrections (scoped enum visibility and equivalent
`is_none_or` queue predicate) are preserved in `clippy-before.log` and the final
independent review. Workspace tests precede those behavior-preserving lint edits;
Clippy compiles all test targets afterward. Tracked logs normalize trailing blank
lines only. Physical F5 pane-action acceptance is pending; the user is currently testing the separate Home machine-filter demo.
No new native UI action has been sent to that user-controlled window.

Source review and headless input tests do not prove physical rendering, real pane
creation or real zoom/unzoom from the F5 menu. Existing pane-action owner fixtures
remain separate evidence. No card closure, merge or release is implied.
