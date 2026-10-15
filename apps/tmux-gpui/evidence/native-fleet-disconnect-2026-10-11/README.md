# Native fleet Disconnect

11 October 2026. Disconnect is reachable from native Home cards and F5 through
`createMachineConnectionManager.disconnect`, the same owner used by the TUI
machine sidebar. It pauses only the captured SSH connection, not its saved
profile. No remote tmux session termination operation is issued.

Capabilities bind the exact handle and endpoint epoch and are consumed before
execution. Replacement, removal, prior disconnect and disposal reject old tokens.
A failed catalog can coexist with a connected SSH transport, so it may still
expose Disconnect. Selected-route retirement uses the existing input/child
retirement path; healthy siblings stay connected. Native request/token guards and
visible full-queue errors apply to both Home and F5.

## Verification

- `bash apps/tmux-gpui/scripts/check-bridge.sh`: TypeScript check and **320 passed,
  five skipped** (packaged-app checks require an explicitly supplied app).
- `cargo test --locked -p herdr-gpui fleet_disconnect`: three focused tests passed.
- `cargo test --locked --workspace`: **2,841 passed, 10 ignored**.
- `cargo test --locked --workspace --all-features`: **2,875 passed, 17 ignored**.
- `cargo clippy --locked --workspace --all-targets --all-features -- -D warnings`
  and the equivalent `--no-default-features` gate passed.
- `cargo fmt --all -- --check`, `bash scripts/check-file-size.sh`, focused bridge
  ESLint, diff checks and `cargo build --locked -p herdr-gpui --bin tmux-ide-gpui`
  passed. Commands ran from the vendored workspace with its pinned toolchain.
- Independent read-only review approved the scoped changes; see `review.txt`.

The model tests cover selected-route lease revocation, unchanged sibling epochs,
preserved profile metadata, unchanged-profile reconciliation, replacement/removal
and catalog failure. Native headless tests cover F5 submission, no navigation or
registry writes, stale request/token rejection and full-queue feedback. Wire tests
cover malformed and reused capabilities. These are not real remote PTY or
persisted-registry byte-equality proofs.

## Native and release limits

A fresh debug presentation fixture was built and launched with private HOME and no
SSH transport. macOS reported a locked desktop before controls could be inspected;
physical pointer/keyboard, normal/narrow appearance and real SSH disconnect/retry
remain pending. The independent Showcase recording demo and production sessions
were not modified. This does not qualify signing/notarization, a packaged release,
other platforms or full Home/F5 parity. The unchanged `block 0.1.6` future Rust
compatibility warning remains visible in the build logs.
