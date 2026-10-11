# Shared Node connection owner — 11 October 2026

Moved existing single-machine authority from TUI runtime into daemon/lib and exposed
`@tmux-ide/daemon/connection-owner`. The TUI adapter retains performance logging.
Lifecycle code remains shared: local discovery, SSH handshake and identity relay,
supervised reconnect, cancellation, generation retirement, disconnect/retry and disposal.
Optional telemetry receives only status/identity metadata and cannot throw into ownership.

Blast radius: the TUI machine registry and authority facade retain their imports;
CLI/TUI bundling follows the adapter to the moved implementation. Host-neutral
client package untouched. Daemon tsc emits the new .js/.d.ts subpath. Native dialog,
profile persistence and native route selection are not wired yet.

Validation:
- 80 lifecycle/SSH transport/relay/machine registry/production graph tests pass.
  Existing owner lifecycle cases now exercise the shared factory directly.
- 2 boundary tests verify package export and bundled transitive imports: SSH
  transport/relay present, no TUI/widget modules or TUI logging side effects.
- Daemon build:tsc passed. Initial callback Record type mismatch fixed at TUI
  telemetry adapter using a spread, with failed/passing build evidence retained.
- Built package self-reference imported under Node24; injected no-network owner
  initialized locally and disposed. Root-level self-reference was unavailable
  because the root does not depend on @tmux-ide/daemon; no package change needed.
- Changed-source ESLint and Prettier passed.

No real SSH connection or production session was touched. This validates extraction,
not new native remote UI acceptance. Real native machine switching, cancellation and
reconnect qualification remain required before fleet parity can be claimed.

18 existing TUI add-machine/sidebar renderer tests passed (104 assertions).
Independent read-only review found no remaining blocker; owner SHA256
`270e88ace80bf22039a3adc38641516c565da7a7fc38fae8a7fc85b57220e8b5`.
Boundary bundle externalizes npm packages; it proves local transitive imports,
complemented by the actual built-package Node24 import check.
