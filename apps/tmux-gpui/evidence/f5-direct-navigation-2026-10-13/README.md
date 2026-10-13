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
ignores (all features). Physical native acceptance remains pending. No release is qualified
by this document, and the older downloadable alpha has not been replaced.
