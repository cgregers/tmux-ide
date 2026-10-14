# Native Home/Terminals/session shortcuts

F1 Home, F2 Terminals and F6 session search reuse the tab/picker owners; F5 stays
the command menu. The menu now exposes Terminals and shortcut hints. Only bare
function keys are reserved. Modified keys keep terminal routing. F2 closes an
overlay even when already on Terminals, restoring focus without clearing the
interrupted-input latch. The Add dialog now explicitly says Save and connect
and explains temporary fallback; persistence is not hidden behind Connect.

Focused picker suite: 19 passed. First compile failed due to the new test referring
to the sibling test commands module instead of production commands; corrected
qualification passed. Independent review caught F2 leaving a picker open and
approved the correction plus tests for Commands/Navigation/Machine overlays.

## Broader gate failure retained

Initial workspace run failed in the existing herdr-client upload source-change
test: the error was not UploadSourceChanged. That assertion originally omitted
the actual error, so its cause is not proven. The exact test passed in isolation
without a behavior change. A diagnostic assertion now includes the variant and
short/growing case without changing expectations. No upload bug fix is claimed.
The original failure and isolated pass are retained.

No physical shortcut/IME or dialog-layout acceptance is claimed. The user's
Showcase remains running untouched. This is not fleet-wide F6/F7 completion
or a preview release.

## Final gate results

Pinned Rust toolchain, `apps/tmux-gpui/upstream`:

- `cargo fmt --all`: passed.
- `cargo test --locked -p herdr-gpui tmux_snapshot::picker::tests`: 19 passed.
- `cargo test --locked --workspace`: rerun 2,828 passed, ten ignored.
- `cargo test --locked --workspace --all-features`: 2,862 passed, 17 ignored.
- `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`: passed.
- `cargo clippy --locked --workspace --all-targets --no-default-features -- -D warnings`: passed.
- `bash scripts/check-file-size.sh`: passed.

The source-change upload assertion did not fail again. Its mechanism remains
unresolved, not fixed by the diagnostic message. Existing `block v0.1.6`
future-compatibility notice remains. External/native ignored tests stay open.
