# Offscreen source fault containment — 12 October 2026

## Reproduction and owner

The real Spark session selected window loaded and then disappeared. A private diagnostic copy recorded an unselected pane's `terminal.delivery.fault` with `state-too-large` before its first seed (revision -1). The client reported this as generic replica validation and terminated every pane. The sanitized `before.json` preserves this mechanism; terminal contents, server identity and raw diagnostic messages are excluded.

GPUI requires the daemon's full-session subscription contract. The fix therefore keeps that contract and retires only a replica whose resource/closure fault is positively proven to belong to a different window. Unknown or ambiguous topology, selected panes, visible siblings, and protocol faults remain fatal. Every later layout rechecks retired panes and fails closed if containment can no longer be proven. Source faults now produce distinct fixed diagnostic codes; raw server error text is never forwarded.

## Validation

- Independent source and diagnostic review approved.
- Component integration uses actual delivery envelopes, encoded seeds/patches and replicas: selected and sibling updates continue; retired offscreen state cannot publish or ACK. Visible faults remain fatal. Includes offscreen faults before and after seed, plus topology changes.
- The same original foreground browser selection ran 15 seconds: six readiness-loss publications before, zero after, retaining the snapshot for 12.43 seconds after loading. Timer exit alone was not treated as success.
- Packaged unsigned `Tmux IDE Reliability Preview.app` opened the same Spark session and shellv2 tab. Native output remained rendered across successive observations. The superseded Window Fix preview was quit; only the new preview remains open.
- No production daemon restart, tmux server/session kill, terminal input, or terminal resize was used for this increment.

## Limits

This contains the offscreen fault; it does not repair the failing source. The shared `state-too-large` reason can represent encoded size, queued-update budget or encoding-job capacity; the precise daemon branch remains to be diagnosed using numeric metadata. Selecting that source still reports its real failure. Source size limits, whole-session subscriptions and validation are unchanged. Long-duration stability, active input, resizing, repeated switching and controlled reconnection require separate qualification. GP03 stays open; this is branch/local-preview work, not an npm release.

Full bridge gate: 419 passed, 5 optional skips, 0 failures. TypeScript, scoped lint and formatting passed. The lifecycle probe also received a reviewed fleet-row/live-session identity fix, with a failing-first regression; exact machine, fleet row and pane selection remain mandatory.

The exact real-host observer then passed: 60,006 ms in stable state, 60 publications, owned child cleanup successful (`after-observer-60.json`). It sent inactive presence before selection and no terminal input or resize. This is a sustained retained-snapshot observation, not proof of active input or a network heartbeat.
