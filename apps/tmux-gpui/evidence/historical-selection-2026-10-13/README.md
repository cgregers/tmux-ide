# Historical mouse selection — before/after proof

The old native build failed the actual scroll/drag/Cmd-C/paste path on 2026-10-13.
An isolated daemon and raw-input producer emitted wrapped Unicode followed by a
hard newline and enough output to put the target strictly into scrollback.
At historical offset 35 the target was visible. Mouse drag produced no selection;
Cmd-C left the known sentinel on the clipboard. Pasting into an owned TextEdit
document exposed that sentinel in its accessibility Value. `clipboard.txt` is
that observed Value transcribed exactly, not synthesized from the expected text.
The fixture exited 1 on exact clipboard mismatch. Zero bytes reached the terminal.
The aggregate failure contained only the clipboard assertion, not a cleanup error.
Screenshots were viewed during operation but are not saved in this evidence set.

The exact corrected headless click/drag/clipboard regression fails against HEAD's
old production code and passes with the proposed fix. The broader focused group
passed 12 tests, including soft-wrap/hard-newline copying and seven negative
admission cases. An earlier test used geometry overwritten by rendering; it is
not relied on for causal attribution. These logs use the corrected same fixture.

The fix separates historical local selection from terminal write permission.
The completed native after-test and local gates are described below. This does
not prove signing, clean-machine installation, or release. No production tmux
server was changed.

Restore `run.mjs.txt` at `.tasks/gpui-native-history-range/run.mjs` for its relative
imports. It requires explicit private app/CLI/evidence paths and opens a QA window.
Baseline package hashes are recorded in `baseline-app.json`.

## Full local Rust gate

Format, file-size check and both Clippy configurations passed. Workspace default
tests passed 2,927 with 10 ignored; all-feature tests passed 2,961 with 17 ignored.
No failures. These are overlapping configurations, not additive test coverage.
The matching rebuilt artifact and physical after-test are recorded below.

## Physical fixed-build result

The same fixture passed with optimized native SHA256
`4e0bd784eae7e2c63069ad592b1e568fc2ec3ccd12c0cd48d5eb97dacc528a77`.
Mouse drag highlighted the target at history offset 35. Cmd-C and actual paste
into the same sentinel TextEdit document produced the exact 157 UTF-8 bytes,
including combining Unicode, CJK, emoji, joined soft wrap and retained hard newline.
The AX Value was captured without normalization. Zero bytes reached the raw
terminal receiver. Cmd-Q left the source identity alive; owned cleanup completed
and the fixture exited 0. A post-quit UI observation reopened the QA app through
its normal launcher; that extra QA app was closed separately without terminal
input. Production servers were not stopped. Initial inactive-window state was
resolved with normal Cmd-Tab before scrolling.

The production app assembled as build 2026101302 with the existing icon. Its three
local-app checks passed with zero skips; the separate QA copy changes only
Info.plist display identity. Build and file hashes are recorded alongside. The
first assembly lacked Cargo on PATH and failed notice generation; using the
existing toolchain completed assembly, without installing anything.

The optional release-profile CLI test was attempted twice, but stopped because
it unexpectedly rebuilt broad dependencies while disk space was limited. It is
not claimed passed. Default/all-feature CLI tests are included in the completed
workspace gates. Signed distribution, clean-machine installation, other GP07
acceptance and full TUI parity remain open. This proof is local and unreleased.

Committed logs remove trailing whitespace only; raw logs remain in `/tmp`.
Clipboard byte evidence is unchanged.
