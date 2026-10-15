# Native F5 Help reference — local work in progress

F5 now offers Using tmux-ide and What’s new through the existing searchable
reference popover. Reference prose wraps instead of truncating, and keyboard
navigation reveals the final paragraph in a 340-pixel-wide headless window.
Actionable menu rows retain their existing behavior.

Independent review found that retained pointer callbacks could replace Commands
while its search field contained marked composition text. The exact new
entry-path test failed before the guard (76 passed, 1 failed), then the same
focused picker suite passed all 77 tests after checking current search composition.
Tests also cover Escape-to-Commands, stale callbacks, unchanged workspace input
geometry, interrupted input and zero terminal commands. These are headless tests,
not physical OS IME or visual acceptance.

The six-file source freeze and explicit local runner environment are recorded.
Independent revised-source review found no remaining scoped blocker. Formatting, file-size checks and both Clippy configurations passed. Full workspace
tests passed: 2931 default and 2965 all-feature test successes, including doctests. The local cached optimized native build passed; its receipt and binary hash are
recorded in native-build.json and native-build.log. Physical normal/narrow visual
checks remain pending. Existing alpha build 2026101302 does not contain these changes.

Everything is local and unreleased. Production sessions and the protected
unrelated bin/cli.js change were preserved. No hosted CI or Sfora update ran.

## Actual native Home reference check

The optimized binary cfb62b8ae1a51685e5e30256b2216436a3f2dbde0d1921d7722d19df16edb921
was assembled into a separate Tmux IDE Help QA app (build 2026101303). Its
Info.plist display name was changed for QA identification only. A synthetic
browser-stdio Home fixture supplied the state; no daemon was discovered or
connected. The normal-width macOS window visibly rendered Help and What’s New
with wrapped, readable paragraphs. Seven Down keys revealed the complete final
Help paragraph; Escape returned to Commands. Searching What’s New for “symbol”
showed only the font paragraph. A second Escape dismissed the popover.

Native screenshots were observed inline, not saved as image files. Attempts to
resize using edge/corner drags left the screenshot dimensions unchanged; the
physical narrow-window check is NOT passed. The headless 340px multiline/reveal
check remains a separate passing test. Native composition and Workspace visuals
also remain unqualified by this synthetic Home run.

Cmd-Q exited the exact owned process with code 0, private HOME cleanup completed,
and only appearance/presence messages were emitted (zero terminal input). The
recorded “Window move completed without beginning” warning followed the failed
resize attempts; it is not attributed to a confirmed product bug. Existing user
alpha/font preview windows were left alone.
