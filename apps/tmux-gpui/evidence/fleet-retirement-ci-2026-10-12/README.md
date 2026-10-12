# Hosted fleet retirement failure — 12 October 2026

Hosted GPUI run38212238042, Linux job114688875893, at7e5e499a failed the fleet Refresh regression with spurious private-host-configuration stderr. Local previous passes were insufficient. A deterministic identity-request barrier reproduced the message while a selected route retired during verification; the original no-barrier case remains covered.

A first catch limited to lifetime cancellation was insufficient (failed log retained). Safe temporary diagnostics showed a verification timeout could precede the retirement callback. The nested server-route assertCurrent guard also throws an untyped error, so the public FleetSelectionError allowlist alone could not classify all retirement paths.

Fix at fleet-runtime.read: capture selection/host/signal; check exact lifetime and normalize only captured selection guard refusal before and after async verification. On verification failure, recheck selection and canonical local proof before rethrowing the original error. Active verification errors remain errors; no fallback, authority resurrection or validation relaxation. Temporary browser instrumentation removed; browser.ts unchanged.

Reviewed frozen hashes in source-hashes.json. Three process scenarios cover ordinary retirement, retirement during held identity verification, and malformed identity while active. Focused14/14; fullgate434passed/5optional skips; TypeScript/lint/diff checks pass. This is source qualification; a fresh packaged/hosted run of this final change is still pending. The existing macOS job on7e5e499a continues and is not proof for this newer change. Physical paste/IME/resize/history remain open. User preview/production sessions untouched.
