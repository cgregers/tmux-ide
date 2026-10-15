# Physical full-pane Unicode clipboard proof

CUA selected the only private test pane, clicked its terminal, pressed Cmd-Shift-C,
then Cmd-V in a fresh plaintext TextEdit document containing a known sentinel.
The accessibility Value of the pasted document was delimited without trimming or
normalization and saved as actual clipboard text. Its 254 UTF-8 bytes exactly match
the canonical visible-pane oracle, including combining Unicode, CJK, emoji, soft-wrap
joins, hard line break and trailing blank rows. Independent tmux capture-pane -J
agreed. Fixture exited 0 after owned daemon/browser/socket cleanup. Native QA closed
with Cmd-Q; all three user demo controllers remained alive.

Initial attempt timed out because TextEdit blocked in NSDocument saving; its unchanged
on-disk sentinel was NOT used as a pass. Retry read the pasted AX Value before save.
The new document was then saved through TextEdit as a scratch text proof. Terminal
receiver was not used: CUA denied Terminal access for safety reasons.

Exact tested native binary is 31792088c01d1d5666476711d1e61f781381ef32b3d4664cbcc2f0af78c63bd3.
Comparison to current source found only the three new editor-menu files changed;
copy/selection/rendering code is identical. This is not a claim about the new editor
build, historical range selection, resize invalidation, or all GP07 acceptance.
