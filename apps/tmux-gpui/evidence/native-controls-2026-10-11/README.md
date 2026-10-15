# Native controls and SVG visibility

New shared native tabs preserve application navigation and daemon window identities.
The first nine-test run failed the application tab height check; restoring the full
application-tab hit region passed the same nine tests. The release demo then showed
blank icon spaces. GPUI Svg::paint requires style.text.color on the SVG itself;
parent text color alone does not trigger painting. Explicit semantic SVG foreground
colors corrected both Home and Terminals icons in an isolated native debug build.

Screenshots home-icons.png and terminal-icons.png show the corrected live app.
Tested icon-fix debug binary SHA256:
da9ce54be8207be95a13bac9bb5e8d0fae43267c3e38574c542ddbcaba592674.
This debug binary was placed in a separate QA app shell; the shell's old release
receipt is not a receipt for this debug executable. No release/package qualification
or performance claim is made. The owned QA window was closed and fixture exited 0.
Existing user demos were preserved.

The later shared sidebar buttons use existing Herdr SVG assets and tooltip views.
All 129 tmux_snapshot tests passed after that migration. Sidebar physical acceptance
and final review are recorded separately when complete. Broader parity remains open.

Sidebar follow-up: native debug binary
1a8d67f3011bf9ca5be860c69feb36fdac1890a6eff7be231cd32c07cb2a8be7
renders all sidebar icons and tabs in light/dark themes (buttons-light.png,
buttons-dark.png). Actual clicks opened Switch and Theme pickers; Dark applied
through the isolated daemon. The attempted corner drag did not resize the window;
physical narrow-window acceptance remains open. Headless 640x400 window-strip
reveal test passes. Hover tooltip display was not physically qualified.

Independent review found no blocking geometry, routing or focus issue. Its minor
asset enumeration finding was corrected by adding tmux-home.svg to Icons::list;
this enumeration-only change followed the physical binary build. Final all-target,
all-feature Clippy passed. The QA app closed and fixture exited 0. Current user
demos remain older builds; do not claim they include this completed source slice.
