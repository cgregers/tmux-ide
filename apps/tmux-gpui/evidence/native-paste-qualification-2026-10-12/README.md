# Native paste qualification attempt — 12 October 2026

Status: physical paste NOT qualified by this attempt.

The maintained native-paste-smoke fixture now accepts an explicitly validated absolute private CLI, validates the executable app launcher, latches cancellation during startup/stages/cleanup, and commits its final receipt synchronously after cleanup. Independent review approved SHA33f4b32c256b043680fcbfa8b5bab446c26f21a6029add4e284647a057ff6d49. Syntax/lint/types pass. The no-GUI cancellation control confirms failed receipt, owned app/daemon stop and scratch deletion; it does not test native paste.

Physical attempt launched a separate unsigned Paste QA copy with a fresh 1e50059b bridge, isolated HOME, supported pinned tmux and private CLI. Its raw PTY producer reached paste-ready. Native screenshot showed Home waiting for catalog; CUA clicks twice returned noWindowsAvailable, although native/launcher/browser processes were confirmed live and a screenshot was available. Rebinding did not restore input. No paste was submitted. Mac unlock status was requested, not inferred as the proven cause.

The exact owned fixture was cancelled with SIGTERM. It exited1, wrote passed:false, and its native/launcher/browser PIDs were confirmed absent. The original Compact Preview remained running. Production sessions were not touched. The failed log and receipt are retained. A fresh unique evidence directory and a usable desktop are required for physical retry.

The expected payload remains PASTE_界_é_🙂 followed by a newline and SECOND_LINE:42bytes including bracketed-paste delimiters. The test retains exact raw bytes, no delayedinput, producerPID/alive and source-survival assertions. These remain unexecuted acceptance requirements here, not successful claims.
