# Session navigation history foundation — 13 October 2026

These are reviewed prerequisites, not a finished F8 user workflow. No native
wire, browser admission or accepted-live-frame integration is claimed here.
The downloadable alpha09 is unchanged.

The pure owner stores at most64 canonical keys and a cursor. Saved newest-first
recents seed chronological history. Adjacent duplicate acceptance adds no entry;
A-B-A revisits remain navigable. Only an exact current frozen attempt ticket and
matching accepted key commit cursor/branch changes. Rejected, stale, forged and
cancelled results do not mutate history. Fresh exact availability is a caller
responsibility; the owner does not resolve routes or cache route capabilities.

The local preference writer adds a dedicated internal recordVisit method. Native
change remains limited to favorite/collapse. Accepted visit intents wait behind
initial loading or an existing preference save, capture verified local owner
identity, and require ready acknowledgement before each POST. Bound:64 waiting
visits plus one in flight. Uncertain failure, owner retirement and disposal
reject queued writes without replay. The returned boolean must be handled by the
browser; no claim of automatic or optimistic persistence is made.

Combined21 tests passed. Scoped ESLint and bridge TypeScript checks passed.
Failing-before evidence includes absent recordVisit API, pure-owner request0 and
reentrant cancellation failures, then their passing paths. An initial TypeScript
failure lost union narrowing inside a Promise callback; capturing the validated
key before the callback fixed it. Runtime guards were unchanged.

Integration must establish a current coherent live attachment before completing
a ticket or recording its visit, seed once from canonical preferences, freshly
resolve exact identities for traversal, preserve the old terminal on rejection
before admission, expose persistence failure, and wire F8/Shift-F8. Those steps
and real/native qualification remain pending; no TUI parity or release claim.
