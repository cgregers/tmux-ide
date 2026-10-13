# Next bounded parity slice: retained session tabs

Design only; no implementation or test result claimed. Source inspected at
1ec81f6f: application-fleet-tabs.ts and application-machine-navigation.ts:462.

- At most eight insertion-ordered retained exact targets, first nonactive eviction.
- Session tabs are distinct from existing tmux window tabs; suspended targets own
  no terminal streams. Daemon admission remains authoritative.
- Remember at accepted live-frame/input-ready seam, never discovery/loading.
- F9 next, Shift-F9 previous, Ctrl-F9 closes active. Close active/pending returns
  Home, never kills session and never auto-opens a neighbor; inactive close changes
  only retained targets. Late completion cannot reopen a closed target.
- Fresh canonical target/incarnation validation before retiring healthy current
  terminal; unavailable target refuses. Existing catalog-to-pane proof is reused.
- Unread completion derives from shared observations (running -> complete), resets
  baseline on observation gaps and clears only upon successful activation.
- Bounded publication uses opaque command capabilities plus revision/request
  fencing, existing global navigation watermark and rejection correlation.
- Native modal/IME/presence/held-key/queue guards reuse current navigation owners.

Tests: duplicate labels and identities across server generations; cap/order;
cycle wraparound; no acceptance before live frame; stale/offline/replaced refusal;
close inactive/active/pending; cancellation/replay/late frame; normal history visits;
shared observation unread semantics; native exact F9 commands with no input leak.

Known TUI arithmetic: with no active tab, Shift-F9 computes the penultimate tab
((-1 - 1 + length) % length). Decide explicitly whether to preserve this or repair
both implementations; do not silently call a different behavior exact parity.

Implement only after current Workspace fleet sidebar acceptance and packaging.


## Prepared acceptance fixtures

`run.mjs`: reviewed private canonical-daemon journey, two sessions, explicit CLI,
no terminal input, metadata-only no-tab assertion, exact activation, stale refusal,
inactive close preserving frame, active close Home, original pane processes/births
preserved. Review-approved SHA
`ee6e3827ebab4ceda96230e064b23a106eb923395420ab08538b3fc55f685665`.
Not yet executed against the implementation.

`native.mjs`: prepared synthetic native B -> F9 A -> inactive B close -> Ctrl-F9 A
close to Home journey, exact three commands with watermark check, no daemon/input,
owned child cleanup and separate visual observation required. Review pending.
Both require fresh output receipts; neither is a performance or remote proof.
