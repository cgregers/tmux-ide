# Shared fleet agent observation prerequisite

11 October 2026. Extracted the existing TUI Home agent observer, authenticated
metadata transport and machine aggregation into `packages/daemon/src/lib/`.
The Node-only `@tmux-ide/daemon/machine-agents` export requires an explicit
connection manager. No TUI renderer or application singleton is imported there.
TUI compatibility adapters retain their existing default manager and selected
machine reader; subscription, generation checks, cancellation, observation bounds
and stale-row behavior stay in the original implementations.

## Change impact

Consumers: TUI Home, machine sidebar and agent navigation continue importing the
compatibility modules. GPUI can now consume the owner without importing TUI state.
This commit does not yet connect it to native Home or claim fleet-wide agent parity.
No terminal mirroring path, Rust UI, wire schema or production session was changed.

The production graph test initially failed 179 versus its old 172-module budget.
A fresh archive of HEAD proved the baseline was already 176; the exact difference
is the three extracted implementation files (`graph.json`). Four prior extracted
owners had not been budgeted. The guard now explicitly names and checks those
seven shared modules, including absence of imports into the TUI, while retaining
its remaining ownership checks. The failed result is preserved, not discarded.

Independent review compared the implementation bodies and approved the extraction.
It caught the optional `readDaemon: undefined` wrapper edge; the final adapter
preserves the original nullish fallback and a new regression covers that case.
The shared-boundary test verifies the local import closure contains no TUI and
checks an explicit empty catalog does not discover any machine or duplicate its
subscription. Existing observer/transport/fleet tests cover actual behavior.

## Limits

This is a reusable prerequisite, not a native user-visible completion. Native
fleet-wide roster projection, coverage/omission reporting, machine filters and
fenced agent jumps remain open. Physical checks still await desktop unlock; real
SSH, packaged installation/update and preview release are not qualified here.
The protected generated `bin/cli.js` was not rebuilt or staged. No merge/release.

## Final validation

- Focused daemon graph, observer, transport, aggregation, authority, catalog,
  navigation and Home fleet suites: **87 passed** across nine files.
- Presentation roster suite: **six passed**; presentation typecheck passed.
- Daemon TypeScript emission into an isolated output directory, TUI typecheck,
  changed-source ESLint and staged diff checks passed.
- GPUI bridge gate: **320 passed / five skipped** (packaged app not supplied).
- Emitted daemon package self-reference import
  `@tmux-ide/daemon/machine-agents`, explicit empty-catalog ownership and disposal
  passed under Node **24.21.0**, using existing workspace dependencies. This is
  not a clean-machine installation or a Node 20 qualification.

The first emitted-package import failed on the presentation root barrel's TSX
renderer dependency. A new narrow `@tmux-ide/presentation/home-agent-roster`
export exposes the existing pure helpers; shared observer imports now use it.
The same plain Node smoke passed afterward. The bundler regression rejects the
root presentation barrel and any local TUI import. Failed and passing evidence is
preserved. A temporary smoke-harness dependency symlink was also corrected before
this comparison; it is not a product change.

No Rust source changed, so Rust gates were not repeated in this extraction slice.
