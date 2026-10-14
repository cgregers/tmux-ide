# Shared Add-machine profile preparation

Owner groundwork only: the native dialog does not yet save profiles.
The existing TUI profile constructor was moved unchanged to daemon lib and
re-exported from its old module. The bridge can now prepare an Add using that
same collision-safe naming/UUID policy without importing TUI runtime state.
Existing enabled aliases retain their saved identity and environment pin.
Stale, unavailable, disabled and ambiguous aliases are rejected before writes.

Review found that valid registries can contain multiple IDs/pins for one SSH
alias. The final implementation rejects that ambiguity with guidance to select a
saved profile; tests cover reversed order and differing enabled states.
Independent review approved the correction.

Checks: nine focused Node tests; seven existing TUI startup tests; full bridge
gate (TypeScript check and 294 passed, five skipped). First Vitest invocation used
the repository root and found no tests; the corrected invocation from
packages/daemon passed. Logs retain that command-setup error explicitly.

No Rust change or native GUI qualification in this increment. Next: wire the
native Add dialog to persistence with request cancellation and explicit uncertain
save/temporary-connection feedback; preserve local registry ownership.
