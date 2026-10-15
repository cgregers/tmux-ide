# Native Home observation recovery

Home now exposes Retry observations and Load more sessions via the same resident
observer as the TUI. Request, roster revision, acknowledged foreground presence
and modal/input guards prevent stale activation. Recovery preserves navigation,
search and selection; it never reconnects healthy machines. The display row cap
does not prevent observing more sessions. Unmodified r/m shortcuts use TUI
semantics and stay isolated from search typing and IME.

## Verified

- Maintained bridge gate:340 passed,5 optional skips, including typecheck.
- Focused native tests:193 passed. Default/all-feature Rust workspace tests,
  both all-target Clippy configurations, formatting, size check and debug build passed.
- Independent reviews approved the source hashes in source.json. Formatting only
  reordered module declarations; scoped lint caught and removed one unused type import.
- Real uninstrumented33-session fixture passed32→33 via Load more, preserved F7
  observation and unchanged connection/request, source identity/geometry/stamps.
- Physical macOS normal-size light-mode QA entered Recovery in Home search and
  clicked Load more. Before/after screenshots show32→33, search retained and the
  same selected Recovery agent03. Native commands contain one fenced recovery
  operation and no navigation or terminal input.
- CmdQ exited the owned native child0. All33 panes survived until fixture cleanup,
  which completed0. An accessibility read then reopened an unconnected QA preview;
  that exact process was terminated separately. Existing user demos were untouched.

The QA app used the current debug binary and source bridge, not a distributable
package. build.json records binary identity; native-source-survival.json records
pane survival. Private raw traces and environment/auth files are not published.

## Failed evidence and prerequisites

The first focused native failure selected a nonexistent key in an empty roster;
normal reconciliation correctly cleared it. The repaired fixture supplies a real
matching row, verifies its initial selection, then checks recovery preservation.
Original failure and passing log are retained.

The live33-session fixture originally failed. Investigation produced two separate
owner fixes: fb008a99 prevents advisory polling starvation;458143b6 removes unused
legacy full-fleet discovery from semantic subscriptions. Old CLI plus the same
observer fix still failed; rebuilt CLI passed. Their dedicated evidence directories
preserve exact failed/passed comparisons. Earlier failure logs here are historical,
not current qualification results. No timing or throughput parity claim is made.

## Limits and reproduction

Actual unavailable-source Retry, physical r/m shortcuts, narrow/dark/IME and remote
recovery remain unqualified. No full-parity card or release acceptance is closed.
The older native-review.json predates the approved module-order adjustment;
source.json is the final reviewed source identity.

```sh
bash apps/tmux-gpui/scripts/check-bridge.sh
cargo test --locked -p herdr-gpui --lib tmux_snapshot -- --test-threads=1
cargo test --locked --workspace
cargo test --locked --workspace --all-features
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
cargo clippy --locked --workspace --all-targets --no-default-features -- -D warnings
cargo fmt --all -- --check
bash scripts/check-file-size.sh
cargo build --locked -p herdr-gpui --bin tmux-ide-gpui
```

Rust commands ran in apps/tmux-gpui/upstream with the explicit isolated toolchain.
The maintained real-process fixture requires explicit TMUX_GPUI_TEST_CLI and the
qualified bundled tmux on PATH; run node --import tsx
apps/tmux-gpui/bridge/home-recovery-smoke.mjs from the repository root.
