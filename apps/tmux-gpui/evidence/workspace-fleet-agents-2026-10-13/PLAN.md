# Workspace fleet agent acceptance

Baseline: 87c44d25. Development remains local. Existing sessions and bin/cli.js
are protected. No public release or remote mutation is part of this slice.

The native Workspace sidebar should retain observed cross-session fleet agents,
matching the TUI agent block above the machine/session tree. F5/F7 search alone
does not satisfy this. Exact routing and current agent activity remain owned by
the shared observer and existing daemon admission. Private-host clients retain
selected-workspace fallback; the header roster remains session-scoped.

Two assumptions to prove:

1. Every enabled published sidebar row has a retained exact route; Home, attention,
   F5 and Workspace projections form a bounded retention union. A query change
   must not invalidate another active consumer's rows. Verify cap and duplicate
   machine/session/pane labels and identities.
2. One shared scanner survives overlapping consumers, while scope/request/roster
   and foreground fences prevent stale callbacks or command replay after retirement.

Consumers: fleet-agents projection/retention; fleet runtime subscriptions; browser
publication/command request ownership; Rust strict publication decoding, selected
row, sidebar keyboard/pointer targets, pending acceptance; bundle builder; source
and packaged tests. Optional wire fields preserve older-helper/private-host fallback.

TUI source: application-machine-sidebar.tsx agent block and scoped team grouping.
Its sidebar filters default sessions, while the shared observer now carries scoped
server identity. Preserve verified observer scopes rather than joining by names.

Prepared checks (not yet run):

- Real isolated daemon: two duplicate-named agents across sessions, A selected,
  F5 no-match/cancel leaves B selectable, stale scope retains A, exact B admission,
  authoritative selectedKey, unchanged pane births/PIDs, owned cleanup.
- Native synthetic: MachineA/B duplicate labels, coverage, exact B command and
  accepted B pane/selection, no terminal input. Visual check separately recorded.
  Both fixtures independently reviewed; tests are not results until executed.
