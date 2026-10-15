# Saved-machine route selection and reconciliation

2026-10-11, backend scope. Native bridge accepts machine-profile navigation by saved UUID and registry revision. It resolves the current enabled profile from the shared local registry and passes sshTarget plus expectedEnvironmentId to the existing SSH owner. No display label supplies authority.

Watched label edits retain the route. Target/environment-pin edits, disable/removal or unavailable registry retire the owned SSH connection and terminal catalog/input. Home/Refresh cannot silently fall back to the original private config after retirement; explicit machine selection is required. Rejected stale selections acknowledge the newly submitted request after retiring terminal presentation, avoiding a native Loading state that ignores old-request errors.

Tests: isolated process journey covers saved selection, rename, target change, refusal of fallback, disable during a pending SSH handshake, Local recovery, and same-request stale-revision refusal without dialing. Unit tests verify expected environment mismatch and all route-reconciliation fields. Independent review approved after finding/fixing request correlation and fixture identity metadata omissions.

Validation: final bridge gate 291 passed/five skipped; TypeScript and changed-file ESLint passed. The first full gate had one existing browser-trace fixture retirement failure (290 passed/one failed); retained here. That exact test passed in isolation and the full gate passed on rerun. No fix or root-cause claim is made for that intermittent fixture result. Initial identity failures were fixture metadata omissions and are retained separately.

No Rust/UI change in this slice and no native/real SSH qualification claimed. Native saved-machine list/Save/edit/remove controls remain next. User clarified v1 scope to fleet and Home/F5 workflows; removed Files/editor and Changes from parity blockers. No release or completed-card claim.
