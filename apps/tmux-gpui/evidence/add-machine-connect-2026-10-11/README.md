# Native Add save-and-connect — 11 October 2026

The existing native Connect form's machine command now prepares a shared profile,
saves at most once through the canonical local registry owner, and connects via
the existing SSH owner. This changes the source bridge; it does not rebuild or
restart the user's recording showcase.

Existing aliases preserve UUID and expected-environment pins. Disabled, ambiguous
and unavailable registries fail closed. Uncertain saves are re-read, never
replayed: a matching committed profile is used, absence allows an explicit
temporary connection, and a conflicting ID/route refuses. Navigation cancellation
permits an already-authorized save to finish but cannot reconnect the stale request.
Local cancellation remains responsive while the save is pending.

Five owner tests cover saved identity reuse, response-loss reconciliation,
cancellation, disabled profiles and post-save/pre-settlement identity changes.
The existing isolated browser process journey now also proves saved-pin reuse by
alias and explicit temporary notice with missing local persistence. Its slow-SSH
Local cancellation path still passes. No production daemon/session is used.

Full bridge gate (TypeScript + Node tests) passed: 299 passed, five skipped.
Initial gate (298 passed) predates the final review correction and extra test.
Review corrected premature “Connected” wording and strengthened the concurrency
test; final wording describes an unsaved connection attempt even if discovery fails.

No native physical Add/save verification, real SSH or release qualification is
claimed. Those remain open, alongside fleet aggregation and Home/F5 workflows.
