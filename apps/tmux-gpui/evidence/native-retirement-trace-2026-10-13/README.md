# Native retirement trace, 2026-10-13

Private diagnostic helper only; no product behavior change. The original packaged
live helper was reproduced byte-for-byte before adding bounded private tracing.
The native binary is unchanged from terminal-font-2026-10-12. The modified app
is not a release artifact and its original manifest does not attest the helper.

First attempt saved Menlo 15 but exceeded the 240-second operator deadline before
restored-setting confirmation. Preserve that failure as an incomplete journey.
A trace labelled the last command resize, but lacked stop state and timestamps.

Second attempt added stop state, process/time identity and allowlisted error code.
Both caught errors occurred after Cmd-Q with stopped=true and
ERR_STREAM_PREMATURE_CLOSE. Independent review mapped the four numeric frames
to Node24 end-of-stream:95/260, events:514 and net:362. live.stop sets stopped
before destroying stdin. The private logger runs before the !stopped diagnostic
guard; the command label is sticky. This is cleanup, not a resize failure.

The complete second physical journey passed: open private session, observe
FONT_READY, F5/font, Menlo14 to15, Cmd-Q, reopen the same private session,
visually confirm Menlo15, Cmd-Q. Raw PTY input remained zero bytes and the source
PID survived both closes; independent fixture cleanup passed. No production
sessions or user previews were modified. Diagnostic trace contains no terminal
content, connection documents, raw error messages or credentials.

The earlier intermittent runtime-failure remains unreproduced and open. This
passing control does not establish absence of that fault. No speculative retry,
authority relaxation or product change is justified by these observations.
