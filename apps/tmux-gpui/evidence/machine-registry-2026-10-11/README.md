# Shared native machine registry boundary

Backend-only increment on 2026-10-11. The native bridge lazily exposes the shared local saved-machine registry through typed read/save/mutate commands. It reads and watches through existing runtime namespace helpers and writes exclusively through the canonical local daemon, independently of terminal discovery and the selected remote transport. No direct registry writes or alternate SSH implementation were added.

The owner re-reads before selecting or mutating to close the filesystem watcher gap, rejects stale revisions and concurrent mutations, retains last valid display data while revoking unavailable authority, and refreshes after uncertain mutation replies without replay. Disposal suppresses late publication. Saved profiles returned by the owner retain their expected environment identity and are cloned at publication boundaries.

Validation: full bridge gate 289 passed, five skipped; changed-file ESLint and TypeScript passed. Five focused owner tests cover stale and disabled selection, corruption/redaction, concurrent writes, disposal and uncertain responses. The isolated browser process test reads an empty local registry while terminal discovery is unavailable. Shared daemon persistence and owner-route tests also passed; see daemon-tests.log. Independent boundary reviewer approved final backend-only scope.

Not yet implemented: native saved-machine list/Save/edit/remove controls, UUID-based connection selection, and reconciling active saved-route edits. No physical UI or real remote machine acceptance is claimed for this backend slice. Existing native Connect remains an ephemeral connection action.
