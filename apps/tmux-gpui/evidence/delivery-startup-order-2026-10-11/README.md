# Startup terminal-delivery ordering

A vertical two-pane session with the retained output producer repeatedly failed
native input readiness. A fresh baseline CLI bundle reproduced the failure,
excluding stale generated output as the explanation. Quiet vertical sessions and
an output-producing horizontal control passed; session naming was not causal.

## Mechanism and change

The daemon websocket owner marked a delivery ready before draining its staged
messages. Each send can yield awaiting pane credit. A later source chunk then
bypassed queued earlier chunks. The regression records actual socket order
`[2, 0, 1]` instead of `[0, 1, 2]`; the canonical client correctly rejected it.

New arrivals now remain in the same FIFO until staged messages finish draining.
The queue is cleared and direct delivery enabled synchronously. Lifecycle faults
retain their immediate path after validated negotiation, so a source-close cannot
be trapped behind bulk credit. Before negotiation they remain staged.

## Validation

- 62 websocket tests passed, including failed-before/passed-after ordering,
  close during stalled replay, immediate source fault, and no pre-negotiation leak.
- 80 delivery-hub/coalescing/hidden-flight tests passed.
- Daemon TypeScript no-emit check, focused ESLint, formatting and diff check passed.
- Fresh private candidate bundle + normal source bridge: original vertical
  producer reached input readiness, printed the exact marker in one pane only,
  returned Home, and reopened with input ready. No diagnostics in final live run.
- Earlier diagnostic candidate additionally recorded ordered chunks 0/1/2. Its
  generic live-connect messages on catalog retirement are retained, not erased.
- Independent review approved final source and tests. No replica validation,
  authority or retry rules were relaxed. No production sessions or user demos
  were touched; every scratch helper, daemon and tmux server was cleaned.

The live check exercised the real daemon/bridge/tmux path headlessly; it does not
claim fresh native GUI, remote SSH, package/install or release qualification.
The transient unavailable status before readiness still appears in the recorded
publications. A total staging-memory bound under sustained arrivals is outside
this regression's proof. No Rust source changed.

## Reproduce

From repository root, with Node 24, dependencies, and the qualified bundled tmux
on PATH (preserve its matching terminfo/library resources):

```sh
node scripts/build-cli.mjs --outfile .tasks/delivery-check/cli.mjs
GPUI_TRIAGE_CLI=.tasks/delivery-check/cli.mjs GPUI_TRIAGE_EXTENDED=1 \
  node --import tsx apps/tmux-gpui/evidence/delivery-startup-order-2026-10-11/reproduce.mjs long-output-vertical
```

The fixture uses a private HOME/daemon/tmux socket and prints sanitized checks.
`GPUI_TRIAGE_RESULT` optionally saves JSON. To compare versions, build the old
source separately and pass its private CLI path; never overwrite a user build.
The exact producer is embedded. `REPORT.md` preserves investigation details;
its temporary paths describe the original run, while this fixture is retained.
