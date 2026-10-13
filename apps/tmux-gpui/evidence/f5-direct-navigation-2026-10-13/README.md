# F5 direct navigation, local branch slice

F5 gains searchable session destinations and agents already published for the
current surface, reusing the existing session and agent selection owners.
Session labels include machine/server context. Agent matching includes project,
harness, and team metadata. Duplicate labels keep distinct canonical targets.

Selections require the current browser request, opaque route or roster revision,
acknowledged foreground presence, and the same picker search entity. Composition,
replacement forms, stale rosters, and a closed/reopened popover reject retained
callbacks. No terminal input path was added.

This is not full fleet-wide Workspace agent search. Workspace still publishes
selected-session agents; Home uses its existing filtered roster. Full parity
requires a separately scoped subscription to the shared fleet observer, bounded
route retention, and corresponding request/scope/revision admission checks.
F7 remains attention-only. This slice must not be used to close that requirement.

Independent source review approved the five hashes in source-freeze.json after
corrections to duplicate-server labels, metadata matching, picker lifetime fencing,
and valid independently scoped test fixtures. The final-source picker suite passed 83 tests; formatting and file-size checks
also passed. Both strict Clippy configurations passed. Full workspace tests passed with
2,951 tests and 10 existing ignores (default), and 2,985 tests and 17 existing
ignores (all features). The subsequent native command-dispatch fixture passed at normal width; see below. No release is qualified
by this document, and the older downloadable alpha has not been replaced.

## Native acceptance

Fresh cached/nonhermetic release build at d02c27da produced SHA256
5065963dad49cfa04b76450b77e48bb9b6548fafe2c1cff89e3bfb41f4d97d8b.
The build receipt records exact native source hashes. A private QA bundle copied
that binary unchanged, with isolated HOME and explicit synthetic stdio state.

Actual F5 key input opened the popover. Query `session beta` displayed the exact
second duplicate session with Beta machine/server labels; Enter emitted its
selection UUID. After a correlated request acknowledgement, `agent beta` showed
the exact second agent; Enter emitted key agent-1, fromRequest 1, revision 4.
The native-pass receipt verifies those commands, zero input/resize commands,
exit zero and no harness errors. The screenshots were inspected in the UI tool
at 2000x1300 pixels; screenshot files were not exported. An edge drag left the
same dimensions, so narrow acceptance is unverified.

This proves native command dispatch, not daemon admission or a live terminal
connection. The synthetic fixture has no daemon, tmux socket, or production route.
This run observed presence false then true; it does not resolve the earlier
intermittent activation observation. The fixture stopped its exact child and
removed its private HOME. A post-quit UI observation relaunched the same QA binary
without arguments into read-only preview; that exact extra PID was then stopped.
No user's application or tmux server was stopped.

The preserved `native-fixture.mjs.txt` was run from
`.tasks/gpui-f5-native/run.mjs` at the repository root; its relative imports assume
that location. Invoke it with Node, the explicit QA executable path, and a fresh
absolute receipt path. The text copy in this evidence directory is not directly
executable from this location.
