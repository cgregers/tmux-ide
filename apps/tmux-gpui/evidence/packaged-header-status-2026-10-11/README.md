# Current native preview package qualification

Source commit `c116537c` was built in release mode using the receipt-producing
local cached build wrapper and assembled as a new macOS ARM64 development app.
Native and bundled Node identities, source hashes and attribution checks passed.
This proves local consistency, not a clean hermetic build or trusted attestation.

All seven `check-packaged-app.sh` checks passed. The exact app's bundled browser
and Node then passed these maintained isolated real-daemon fixtures:

- `browser-history-smoke.mjs`: history offset, read-only history, return-to-live
  input, navigation clearing, source identity preservation and cleanup.
- `new-window-smoke.mjs`: one new window, exact new-pane input, duplicate/stale
  refusal, original pane preservation and cleanup.
- The same new-window fixture with `TMUX_GPUI_TEST_AGENT=claude` and `codex`:
  structured agent metadata, exactly one inert harness invocation and new-pane
  input. No real personal agent executable or credentials were used.

All four ran with `TMUX_GPUI_TEST_APP` set to the app recorded in qualification.json,
`TMUX_GPUI_TEST_CLI` set to the private CLI, the pinned tmux directory first in PATH,
and Node 24 with `--import tsx` for the fixture driver. The browser child uses
bundled code from private scratch cwd, without a source fallback. Logs and hashes
are retained here. This is packaged bridge qualification, not a native GUI test.

The app is unsigned development output, not merged, distributed or released.
`security find-identity -v -p codesigning` still reports zero valid identities.
Signing/notarization, real remote SSH, physical release acceptance, clean-machine
install/update and public download checks remain open. Existing user demo windows
and production sessions were not replaced or modified.
