# Spark terminal attachment diagnosis

The user's real Spark sessions listed but did not load in GPUI source c116537c.
A separate catalog-only helper reproduced cockpit returning four panes followed
by Session layout unavailable. No terminal commands or content were recorded.
A diagnostic copy (not the installed app) showed HTTP using tunnel port 59113,
while the issued WebSocket targeted remote daemon port35513 on local loopback.

The GPUI fix retains the original WebSocket origin from the verified SSH
handshake and validates it before rebasing only the origin to the local tunnel.
Path/query/subprotocol remain intact. Direct local/private hosts remain unchanged.
With the fixed standalone helper, the same Spark cockpit catalog completed with
four panes and a preferred pane. This proves the initial routing failure fixed.

Interactive loading then revealed a separate installed-daemon defect: a pane's
first observed chunk was index2 while its replica expected0, within a matching
transaction. The index2 payload was98,872bytes of623,160 total (3chunks). This is
the known startup delivery race fixed in existing branch commit90606cf5; replica
validation was retained rather than bypassed.

Read-only SSH confirmed Spark runs tmux-ide2.9.5. Installed CLI SHA256:
51c800a577a84f2fc5b2bcfefdec26497d25e84cbf967d7d7c814b47ce920c79.
Its startup code calls markReady() before awaiting queued sends. The branch fix
keeps live arrivals in the same FIFO until replay drains. No Spark daemon was
upgraded/restarted. Actual remote terminal rendering remains blocked on that
installed-daemon correction, so this is NOT an end-to-end success claim.

A development copy, /private/tmp/Tmux IDE Spark Fix.app, contains the guarded
routing fix. It uses the existing release-mode native binary plus rebuilt bridge;
it is unsigned local test output. The user's old preview remains separate.

Validation: 23 focused routing/host-source tests passed, scoped lint and full
bridge TypeScript/check gate passed395tests with5explicit optional skips. The
broad gate first exposed a separate trace-fixture cancellation race: intentional
abort could truncate a JSON line, which ordinary EOF validation treated as an
error. A deterministic failing test now passes; incomplete ordinary EOF remains
rejected. No timeout was increased. Failed and passing evidence is retained.
