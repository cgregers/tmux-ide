# Fleet-wide F5 agent search — local qualification draft

This slice adds fleet-wide F5 search over the **currently observed** shared agent roster from Home and Workspace. Query matching uses each term against command text, agent/session/machine/server/project/harness/team metadata before the 256-row publication cap. Source observation coverage and truncation remain explicit: this does not discover agents in sessions the shared observer has not observed. Private host-file previews retain their contextual agent fallback.

## Source and authority scope

`bridge-freeze.json` binds ten bridge implementation/test files, verified against the working tree when copied. `native-freeze.json` binds the final 24 native files (manifest shape `{head, files}`), verified after the test-only Clippy initializer repair.

Palette observation uses monotonic request/scope/revision fences, opaque retained target keys and foreground admission. Invalid selection returns a correlated rejection while preserving the current terminal. Valid selection publishes the new request's loading state before asynchronous retirement and uses the existing fresh daemon route verification. Query projection adds a bounded visible-target budget to the existing Home/attention union without changing their filters. Closing the palette releases its additional budget.

Independent review found that cancel/reopen on each query would tear down the shared scanner when F5 was its only subscriber. The repair updates the existing subscription atomically on a higher query scope; native query changes retire old rows locally without sending a close. Final dismissal still closes the subscription. The actual fleet-owner test proves one source start across palette-only query changes; the palette-owner test proves later callbacks publish the new scope/query and callbacks after final cancellation are ignored. This was a source-review finding repaired with direct regression coverage, not a measured production performance claim.

## Completed checks

- Maintained bridge gate: **468 passed, 0 failed, 5 explicit optional skips**, with bridge TypeScript check successful (`bridge-gate.log`). Command: `PATH=/private/tmp/tmux-ide-295-release-nkydyctm/bin:$PATH bash apps/tmux-gpui/scripts/check-bridge.sh`.
- Final late-callback assertion was added after that full gate and independently passed in the complete palette-owner suite: **7 passed**, `node --import tsx --test apps/tmux-gpui/bridge/palette.test.ts` under the same Node 24 PATH (`bridge-query-final.log`).
- Scoped ESLint over the ten bridge files in the manifest passed (`bridge-lint.log`, empty on success).
- Native reviewed focused run: **280 passed, 0 failed**, before the final test-only Clippy style repair (`native-focused-reviewed.log`). Broad native gate completion is not claimed here. Exact focused command: `RUSTUP_HOME=/private/tmp/tmux-gpui-toolchain/rustup CARGO_HOME=/private/tmp/tmux-gpui-toolchain/cargo PATH=/private/tmp/tmux-gpui-toolchain/cargo/bin:$PATH CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0 cargo test --manifest-path apps/tmux-gpui/upstream/Cargo.toml --locked -p herdr-gpui --lib tmux_snapshot -- --test-threads=1`.

## Preserved failures

- Initial native compile failed with test macro recursion (`native-focused-compile-before.log`), fixed by the explicit standard test import used by existing fixture modules.
- The next focused run had **271 passed / 1 failed**, an `Option::unwrap()` in the new Workspace palette test (`native-focused-before.log`). The test had published request 0 against native request 7, so the scope guard correctly hid its row. The fixture was aligned to request 7. The later 280-test passing log supersedes this test run; the original failure is retained.
- Broad native Clippy then stopped on two `field_reassign_with_default` findings in new tests (`native-clippy-style-before.log`). Initialization style was repaired without suppressions. The final source hashes are copied; both strict Clippy configurations subsequently passed; full workspace tests remain pending.

`evidence-inputs.json` records the original `/tmp` file hashes and evidence-copy hashes. Copies either preserve bytes or normalize trailing whitespace as recorded per file. The input hashes describe the bytes actually copied, not historical contents of mutable `/tmp` paths.

## Synthetic native fixture and remaining qualification

A prepared, **not yet launched** private harness is at `.tasks/gpui-global-palette-native/run.mjs`. It uses the production palette owner with 300 synthetic non-attention agents and an in-memory fleet dependency. The intended physical journey changes query from `agent ordinary` to `agent zebra`, chooses exact agent-299 beyond the initial publication cap, then verifies the accepted Remote workspace/agent display before quitting.

Its counter proves mock subscription reuse, not an actual fleet scanner or canonical daemon connection. Its receipt distinguishes an accepted publication being sent from separate visual verification. Maintained fleet-owner tests cover actual shared scanner lifecycle; this synthetic UI fixture does not replace a real daemon/fleet end-to-end journey.

Pending before completion:

1. Record terminal results of the parent's broad Rust gates, including any further failures; no running gate is counted as passed.
2. Build/package and perform physical native qualification with an explicit artifact; no such result is claimed by this draft.
3. Preserve the distinction between observed-roster search and source observation/load-more limits.

## Parent validation checkpoint

Both strict Clippy configurations, final-source formatting and the 1,000-line
file-size check passed. The parent independently verified all 34 frozen source
hashes and the reviewed synthetic fixture hash. See `parent-checkpoint.json`,
`clippy-all.log` and `clippy-minimal.log`. Full workspace test results and native
physical qualification are still pending; the branch has not been released.

## Completed broad native gate

Both workspace test configurations completed successfully on the frozen final
source: {'passed': 2960, 'failed': 0, 'ignored': 10} (default), {'passed': 2994, 'failed': 0, 'ignored': 17} (all features).
Exact commands: `cargo test --locked --workspace` and
`cargo test --locked --workspace --all-features`, with the same isolated
Rust toolchain and single-job environment as the focused run. Full logs are
`workspace-default.log` and `workspace-all.log`. This supersedes the draft
pending-test statements above. Native physical qualification remains pending.
