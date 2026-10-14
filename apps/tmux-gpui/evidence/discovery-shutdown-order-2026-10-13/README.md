# Controlled shutdown diagnostic ordering

Hosted Linux run 38220751912 failed after the fixture stopped its owned daemon,
before replacement startup: snapshot was cleared and input disabled, with a
source-closed diagnostic. The fixture required WebSocket close code 1001 only.

Canonical TerminalDeliveryHub.close() calls resetForSessionRestart(), which
enqueues source-closed before closing clients. That lifecycle event can win the
race with WebSocket shutdown; the bridge intentionally retains the first fault.

The fixture now requires no diagnostic before the controlled stop, then exactly
one strict source-closed or transport-closed/1001 diagnostic and its exact visible
status, a newer publication, null snapshot and disabled input. The same diagnostic
must remain the only stderr record through replacement and recovery. Existing
same-browser, changed daemon identity, exact input before/after, stale-input refusal
and owned cleanup assertions remain unchanged. No product behavior or timeout changed.

Local unchanged and corrected full-path runs both passed. Thus local failure was
not reproduced; the failing-before proof is the hosted excerpt. The corrected
local run proves recovery but does not separately identify which shutdown event
won. Hosted Linux confirmation remains pending. No GUI or production sessions used.

Commands from repository root (Node 24, pinned tmux, explicit private CLI):

```sh
PATH=/private/tmp/gpui-split-promoted-eg12r6nf/bundle:/private/tmp/tmux-ide-295-release-nkydyctm/bin:$PATH TMUX_GPUI_TEST_CLI="$PWD/.tasks/gpui-new-window-fixed/cli.mjs" node --import tsx apps/tmux-gpui/bridge/discovery-recovery-smoke.mjs
pnpm exec eslint apps/tmux-gpui/bridge/discovery-recovery-smoke.mjs
```
