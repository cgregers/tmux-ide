# New-window local triage — 2026-10-13

Hosted Linux run 38358295653, job 115166234897 failed after a validated creation receipt with “New window created; pane unavailable — refresh”. The excerpt preserves the failure. Retained browser pane choices do not establish fresh native membership. Root cause remains unknown.

Three macOS ARM64 local controls passed: prior private CLI + patched tmux (`baseline.log`), freshly built current private CLI + patched tmux (`current.log`), and fresh CLI + unpatched upstream tmux (`upstream.log`). Each asserted exact new-pane input, duplicate/stale refusal, original source identity and cleanup. These are not Linux qualification.

The maintained fixture adds failure-only bounded native IDs and safe browser state, without changing deadline or success assertions. The exact source journey passed again (`evidence-after.log`). Syntax/lint/diff checks passed.

`forced-failure.mjs` is a private diagnostic clone, not a maintained oracle: absolute imports retain the original fixture dependencies; one intentional assertion occurs after initial pane readiness and native baseline capture, before mutation. It exits 1 as expected (`forced-failure.log`). Its evidence has one original native pane, input ready, ERR_ASSERTION and no receipt-created target. Independent checks verified the scratch root was removed and captured source PID was gone; only the intentional failure remained. No success receipt was printed. `receipt.json` records these checks.

Private CLI build used scripts/build-cli.mjs --outfile .tasks/gpui-new-window-ci38358/cli.mjs; protected bin/cli.js was not rebuilt. All new runs were local, with isolated tmux/daemon fixtures. No GUI, production changes, hosted reruns or pushes.
