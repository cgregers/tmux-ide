# Isolated packaged runtime-failure investigation

Both runs use the unchanged Font QA bundled Node/browser/live against a fresh private raw Node PTY and explicit private CLI. No native GUI or production daemon was used. `packaged.log`: 30 resize plus acknowledged background/foreground cycles. `presence-only.log`: 30 back-to-back background/foreground pairs, no resize. Its logged cols/rows are unused generated values, not applied geometry. Each run finished with five seconds idle, inputReady true, no helper stderr, zero raw terminal input, and exact pane ID/PID/birth preserved. Browser/daemon/fleet independent cleanup completed before success.

The earlier physical runtime-failure was NOT reproduced; these results do not dismiss it. They do not exercise native focus event ordering, font rendering or picker interaction, nor prove a requested resize was applied (presence can supersede a queued viewport). Script remains a private diagnostic derived from new-window-smoke; no maintained product changes or root CLI rebuild.

If recurrence warrants another diagnostic, instrument only a private copied live helper to distinguish runtime onFault from command-loop catch, plus bounded command kind/presence revision/viewport and sanitized error class/stack location. Do not log terminal data, connection documents, URLs, or raw error strings. No reason to loosen authority/validation or add retries from these passing controls.

`diagnostic-script.txt` is the exact diagnostic source; its relative imports expect execution from `.tasks/gpui-runtime-fault-repro/run.mjs` within this worktree. Requires explicit TMUX_GPUI_TEST_APP and private TMUX_GPUI_TEST_CLI; set REPRO_PRESENCE_ONLY=1 for the second mode. This is evidence, not a new supported test runner.
