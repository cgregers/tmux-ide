# Native saved-machine picker — 11 October 2026

Branch-only implementation; no release or fleet-parity completion claim.

F5 → Switch saved machine opens a centered searchable dialog. A lazy typed read
uses the current request; rows retain UUID and registry revision. Selection checks
current request, revision, registry availability and enabled membership before
routing through the daemon-backed bridge. A successful queue retires terminal
selection/input while awaiting the authoritative connection publication.

Dedicated headless tests verify the serialized read/select commands, rejection of
stale row callbacks, disabled/deleted/unavailable profiles, input isolation, Escape
and a disconnected read queue. Four focused tests passed. Independent read-only
review found no blocking defects in this scope.

Physical saved-picker acceptance (pointer selection, long list/labels, narrow
layout and real SSH) is still open. The user's Showcase is running for recording;
this validation does not interact with it. Existing terminal showcase rendering is
not evidence for saved-machine selection. No card is closed by this increment.

Next fleet parity slice: match the TUI Add machine persistence behavior through
the existing local registry owner, including its explicit ephemeral-only fallback.
Home fleet aggregation, machine filters and remaining F5 workflows stay open.

## Verification

With the pinned toolchain in `apps/tmux-gpui/upstream`:

- `cargo fmt --all`: passed.
- `cargo test --locked -p herdr-gpui tmux_snapshot::picker::tests::saved_machines`: 4 passed.
- `cargo test --locked --workspace`: 2,824 passed, 10 ignored.
- `cargo test --locked --workspace --all-features`: 2,858 passed, 17 ignored.
- `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`: passed.
- `cargo clippy --locked --workspace --all-targets --no-default-features -- -D warnings`: passed.
- `bash scripts/check-file-size.sh`: passed.
- `git diff --check -- apps/tmux-gpui`: passed.

Ignored external/native tests remain unqualified. Cargo reports the existing
future-compatibility notice for `block v0.1.6`; no dependency upgrade was made.
The bridge is unchanged by this increment; its earlier route checks are recorded
in `../saved-route-2026-10-11/`.
