# Native dead-key composition and pane attribution

Physical run on 13 October 2026 passed in the separate Composition QA app.
The parent operator used CUA with the actual native window; this reviewer did
not drive the desktop. The operator reported:

1. Selected left pane A and pressed Option+E. An underlined dead-key mark was
   visible; both raw PTY files remained empty before nonce confirmation.
2. Pressed E once. A contained exactly UTF-8 `é` (`c3a9`); B was empty.
3. Pressed Option+E in A again. The underlined mark was visible; A still contained
   only the original `c3a9`, and B remained empty.
4. Clicked right pane B, observing the mark clear, and typed plain `x`. A remained
   `c3a9`; B contained exactly `78`. No paste or Return was used.
5. Cmd-Q closed only QA. The harness checked both captured producer PIDs remained
   in their original panes, both panes were alive, and neither file gained bytes.
   Independent app/daemon/fleet cleanup completed before the pass receipt.

Receipt, raw bytes, four nonce confirmations and controller log are retained.
`source-after-close.txt` contains only owned producer output. `exactBytes: 2` and
the receipt SHA refer to A; B is independently recorded in `paneBHex` and
`identity.json`. The receipt lists only A's PID, but the runner checked both.
Bracketed paste was disabled. Byte files and confirmation nonces were independently
verified during preservation.

CUA images appeared in the conversation; no screenshot file was saved. The
operator account supplies the marked-UI/OS-path evidence. Raw bytes alone cannot
distinguish OS composition from injected input. This qualifies this dead-key
commit and pane-switch attribution journey only, not all IMEs, Escape cancellation,
focus loss to another application, accessibility, signing or all keyboard layouts.
User demos were not operated.

## Artifact and reproduction

`app-copy.json` records the branded source app and separate QA copy. Its recorded
hashes precede the intentional Info.plist identity/name change: current verification
found exactly that one difference. All native, Node, bridge and other file hashes
still match. `identity.json` records current hashes including the changed plist.
These hashes do not establish signing or notarization.

`run.mjs.txt` is the exact executed private specimen, not a maintained smoke.
The text suffix preserves its exact executed bytes without formatter changes. Its
imports are relative to its original repository location. Copy it back to
`.tasks/gpui-native-composition-repro/run.mjs` before executing from the root.
Use a fresh evidence directory and separate app. The operator writes each logged
nonce exactly (no newline) to confirmationPath after the observation. Overall
operator deadline is 600 seconds; signals trigger independent cleanup.

```sh
PATH=/private/tmp/gpui-split-promoted-eg12r6nf/bundle:/private/tmp/tmux-ide-295-release-nkydyctm/bin:$PATH TMUX_GPUI_TEST_APP='/private/tmp/Tmux IDE Composition QA.app' TMUX_GPUI_TEST_CLI="$PWD/.tasks/gpui-new-window-fixed/cli.mjs" TMUX_GPUI_COMPOSITION_DIR='/private/tmp/gpui-composition-NEW' node --import tsx .tasks/gpui-native-composition-repro/run.mjs
```

No rerun, GUI operation, product edit or commit occurred during preservation.
