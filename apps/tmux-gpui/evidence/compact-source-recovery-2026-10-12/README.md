# Recover complete source state using existing compact delivery

The remaining Spark failure was a legacy semantic seed of 17,999,739 bytes exceeding the unchanged 16,777,216-byte representation cap. An anchored parser of the existing fault message retained only numeric counters and a fixed category in a private diagnostic copy. Selecting the affected pane with the previous bridge produced source-state-limit and no snapshot.

GPUI now offers semantic-compact-v1 and semantic-v1, matching the production TUI. Its existing replica already uses the shared authenticated decoder and canonical state/hash validation. No new decoder, truncated history, raised limit or daemon deployment is involved. Explicit semantic fallback remains negotiated. This does not promise compatibility with old daemon schemas that do not recognize the compact encoding enum.

## Validation

- Same selected real pane with a private compact offer retained its snapshot for 12.566 seconds of a 15-second reproduction with zero losses.
- Source-built packaged bridge: exact-ID inactive real-host observer retained snapshot for 60 seconds; isolated fixture retained snapshot for 30 seconds; both completed cleanup. Exact results/artifact hashes accompany this file.
- Native Tmux IDE Compact Preview opened the formerly failing sfora-login window and displayed its terminal. Physical input, resize and scrolling are not newly qualified here.
- Full bridge gate: 422 passed, 5 optional skips, no failures. Added actual replica tests cover multi-chunk compact seed and history patch, Unicode/wide/combining cells, no premature ACK, exact committed ACKs, negotiated fallback and malformed/hash/baseline rejection with retirement. TypeScript, lint and formatting passed.
- No production daemon restart or tmux server/session kill. Diagnostic and observer probes sent no terminal input or resize.

The 16 MiB wire limit and 8 MiB native-publication limit remain. This fixes the reproduced legacy-encoding refusal; it is not a claim that arbitrary terminal state fits either bound or that all preview-release acceptance gates pass. Broader switching, foreground/input, resizing and reconnect qualification remain on the mission.
