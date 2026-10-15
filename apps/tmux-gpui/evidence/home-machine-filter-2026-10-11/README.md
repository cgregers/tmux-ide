# Home exact-machine filter — 11 October 2026

Implemented and independently reviewed; physical acceptance remains open.

The bridge filters the shared Home agent roster by exact published machine ID before
its 256-row cap. Native `f` and the machine button cycle All/published machines,
using the current request/roster revision and acknowledged foreground presence.
The visible selection follows the publication acknowledgement. Search/activity
filters remain local and intact; F7 remains fleet-wide. Removed or unpublished
machine selections reset to All. Display labels never become routing identities.

The private routing table retains the bounded union of visible Home and attention
rows; selecting a later machine cannot lose routes merely because unrelated
machines filled the global ordinary-row prefix. Observer ownership remains shared.

## Checks

- Maintained bridge gate: 346 passed, 5 optional skips; focused lint passed.
- Real isolated local daemon/tmux fixture: two sessions, valid filter/clear ACK,
  stale clear rejection followed by ordered presence barrier, unchanged identities
  and geometry, unchanged F7 scope, no promotion, owned cleanup. See `live.log` and
  maintained `../../bridge/home-machine-filter-smoke.mjs`.
- Native focused: 198 passed. A later test-only modal fixture amendment makes
  foreground readiness explicit before exercising the modal guard; both subsequent
  workspace runs include it.
- `cargo test --locked --workspace`: passed.
- `cargo test --locked --workspace --all-features`: passed.
- Both all-targets Clippy feature configurations with `-D warnings`: passed.
- `cargo fmt --all -- --check`, source-size check and debug build: passed.
- Independent exact-source reviews: `native-review.json`, `bridge-review.json`.

Tests and build apply to the manifests in this directory, before the separately
in-progress F5 pane-action change. `build.json` identifies the private debug binary;
it is not a distributable package receipt or release qualification.

## Physical status and retained attempts

An initial QA launch found a pre-existing app at the intended path. Bundle creation
refused to overwrite it, but the following shell command still launched that older
app. Its binary hash differed from the new build; the exact fixture controller was
stopped and reported owned cleanup. This attempt is excluded from acceptance.

A fresh uniquely named `Tmux IDE Home Filter Verified QA.app` was assembled from
the recorded binary and launched with a private HOME/socket and two fixture sessions.
The user began testing it and confirmed entering commands. UI automation stopped;
its controller was suspended to prevent the 240-second cleanup deadline from
closing the user's active demo. This is a user-controlled development demo, not a
completed physical machine-filter test. No screenshots or survival claim from that
active run are used as acceptance evidence. Private traces/state remain under
`.tasks/gpui-home-filter-qa/`; state files contain environment data and are not
published here.

Outstanding: physical `f` and button cycling with retained search, narrow/long-label
layout, modal/IME behavior, real multi-machine/SSH filtering. Duplicate labels,
removal, overflow and stale revision behavior currently have deterministic test
coverage only. No card closure, merge or release is implied.

Tracked test logs normalize trailing blank lines only; original logs remain in `/tmp`.
