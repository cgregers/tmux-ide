# Compact preview interaction and recovery checks — 12 October 2026

Executed the packaged Node/browser/live artifacts against disposable HOME, daemon and pinned tmux socket. The user's running Compact Preview and production sessions were not used as fixtures. Artifact hashes are retained here.

- History: scroll offset, return to live input, navigation clears offset, source identity preservation; cleanup passed.
- Resize gesture: authoritative source geometry changes before release, burst final target, presence loss cancels movement, vertical sizing with pane status border.
- New window: exactly one distinct window created and selected, authenticated input targets its pane, duplicate/stale commands refused, original source identity preserved.
- Discovery recovery: browser starts before daemon; explicit Refresh connects in the same browser. Authenticated input lands before and after owned daemon replacement; input with stale request never reaches source. No automatic reconnect claim.

The existing recovery test initially failed because it expected the old generic unavailable status and empty stderr. Metadata-only diagnosis proved snapshot=false/inputReady=false and the exact transport-closed/1001 diagnostic. The corrected test requires that exact status and only that diagnostic; it still fails on arbitrary errors and preserves all input/recovery assertions. No runtime code was changed in this increment. Resize fixture gained an explicit private-CLI path so validation does not rebuild the protected root bundle.

These are real tmux/daemon tests through packaged browser delivery. They do not exercise native mouse/keyboard widgets, prove arbitrary long-term stability, or satisfy signing/install/release acceptance. The mission remains active.

## Repeated switching and recovery

The maintained isolated probe completed two full cycles through two exact windows (two-second holds), observed cleared snapshot/input authority on owned daemon shutdown, and recovered both original targets through explicit Refresh in the same browser. It checked all 123 publications and completed independent cleanup. Native identities survived from pre-admission; geometry stayed unchanged after supported initial admission.

Its initial end-to-end check correctly noticed top/height changed. Diagnosis traced this to the existing first-adoption pane-border-status=top behavior in `packages/daemon/src/lib/workspace-promotion.ts`. The final oracle preserves identity from before admission and takes geometry baseline after the first complete authoritative session catalog. The two failed logs are retained; no product fallback was added. Independent review checked exact targets, bounded framing, unexpected diagnostics, cancellation, cleanup and the corrected baseline.

Final bridge gate: 427 passed, 5 optional skips, no failures. Changed fixture/probe lint and formatting passed. Review approved; runtime source and the existing Compact Preview app did not need replacement.
