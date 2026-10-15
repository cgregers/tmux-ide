# Isolated delivery ordering diagnosis

No GUI or protected demo was operated. Scratch fixtures independently cleaned their helper, daemon and tmux fleet. Diagnostic copies emitted only fixed error categories and numeric transaction ordering metadata. No tracked product edits were made during triage; the subsequent confirmed repair changes only the two websocket owner/test files.

## Discriminating fixtures

`run.mjs` selects the requested private session explicitly. Its output variants run the exact synthetic producer extracted from the F5 QA script. Long/short names isolate naming from pane orientation and seed size.

- `/tmp/gpui-triage-longvertical.log`: quiet long vertical reaches ready.
- `/tmp/gpui-triage-shortvertical.log`: quiet short vertical reaches ready.
- `/tmp/gpui-triage-longhorizontal.log`: quiet long horizontal reaches ready.
- `/tmp/gpui-triage-outputvertical.log`: long vertical with producer fails chunk admission.
- `/tmp/gpui-triage-output-shortvertical.log`: short vertical with producer fails identically.
- `/tmp/gpui-triage-output-horizontal.log`: long horizontal with producer reaches ready.
- `/tmp/gpui-triage-output-vertical-trace.log`: repeated short vertical failure; same transaction receives envelope then chunk2 when next expected index is0. Metadata-only child had completed all three chunks beforehand; interactive child failed.

Per-mode JSON files in this directory retain sanitized transitions. Fixture process exit alone is not the success oracle: inspect the final readiness/timeout fields. Parent separately reproduced against a freshly built baseline CLI with `verify.mjs baseline-output-vertical` (baseline-output-vertical.json), avoiding stale generated output.

## Proven owner mechanism and repair

`packages/daemon/src/terminal/pane-stream/pane-stream-websocket.ts` staged source callback around1460 queues messages until ready. Initial replay around1607 formerly marked ready before awaiting its queued sends. Each send awaits pane-local credit (around1716). A live callback during that await therefore bypassed queued chunks.

The real socket-owner test `preserves chunk order when live delivery arrives during staged seed drain` stalls socket credit after the envelope, emits chunk2 while0/1 remain queued, then drains credit. Before repair, actual transmitted indexes were `[2,0,1]`: see `handoff-before-confirmed.log`. Earlier `handoff-before*.log` files include harness setup failures and are not the mechanism proof.

Minimal repair retains staged FIFO delivery until the dynamic array finishes draining, clears that drained array, then enables direct delivery synchronously. No replica validation, retry, authority or UI behavior is relaxed.

`handoff-after-final.log`: all60 websocket tests pass, including the same ordering path and close-during-stall (delivery closed once, no later frames). `handoff-typecheck.log`: daemon tsc --noEmit exit0. Formatter and git diff --check pass.

Frozen source SHA256: abccd2fc28e38a1ad11c6153a3660d3b2bf8e2878aaf48ca896c01b4aebf0adf.
Frozen test SHA256: a1a268fdc040614b267ae112ebc01a826d13e15fb12ed861e1ec896478006d02.

Parent owns the fresh candidate same-path real fixture rerun. These tests do not establish a total dynamic staging-memory bound or prompt source-fault forwarding under stalled initial replay; the queue clears on completed drain. No native UI qualification is claimed.

## Lifecycle follow-up

The initial FIFO repair regressed immediate fault forwarding during stalled seed replay. `fault-before.log` proves the new source-fault control saw zero fault frames with credit withheld. Final repair separately tracks validated negotiation: source faults bypass bulk replay after terminal-delivery-ready, while pre-negotiation faults remain staged. Envelope/chunk FIFO remains unchanged.

`fault-after.log`:62/62 tests pass, covering immediate fault without returning credit and deferred pre-negotiation fault with no leak through close. Final source SHA256 eb6073fbbe93d4766cfb2c425bc62707073228c439f2de79bca9a4f22d822a94; test b33125aec18fc4e64e40112b798f81c608bcef528c6f2df06c90f020dceb1d38. Earlier hashes above identify the superseded intermediate fix. Total staging-memory bounds remain outside this regression proof.
