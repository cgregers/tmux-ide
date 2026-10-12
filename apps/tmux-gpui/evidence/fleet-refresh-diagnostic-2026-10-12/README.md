# Retired fleet Refresh diagnostic — 12 October 2026

Following native recovery qualification at 49f908d3, its short log contained a transient private host configuration warning. A deterministic actual browser process regression independently reproduced the same diagnostic class with an isolated HTTP/discovery fixture: select an exact fleet server, remove its discovery record, observe route retirement, then Refresh twice.

Before: the fixed FleetSelectionError was caught by the private-document redaction catch, logged as unreadable private configuration, and reduced to generic start-daemon guidance. Both failing assertions are preserved. This proves the mechanism in the focused fixture, not the precise timing of the earlier physical run.

Fix: preserve the existing safe FleetSelectionError in readHost and launchRefresh. The browser now gives the existing refresh-fleet/reselect-session guidance. No route resurrection, fallback, new authority, parser bypass, or daemon change. The test verifies null snapshot, input disabled, no selected server/sessions and unchanged browser connection across repeated Refresh.

Validation: focused 5/5 including private-config redaction and discovery controls; TypeScript, lint and diff checks pass. Full bridge gate: 428 passed, 5 optional skips, 0 failures. Exact source/test SHA values in freeze.json. Independent review approved these exact frozen source/test hashes; no scoped blockers.

This is source/real-browser-process qualification using a private HTTP fixture, not a newly packaged native GUI run. The open user preview is unchanged. No production server/session touched; unsigned preview and broader physical parity work remain separate.
