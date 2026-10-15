# Native fleet selection and saved-machine persistence

11 October 2026, macOS. Native implementation: `aeb5a9a4`; checkout HEAD during
verification: `439385f7` (subsequent commits were evidence-only). This is a local
working-source/debug-native check using the existing `bin/cli.js` daemon bundle,
not qualification of a freshly packaged release.

## Observed native journey

- Opened F6, typed `9536-1`, and observed exactly the second isolated session.
- Enter opened that session's window and shell. Clicking the terminal and entering
  `printf 'GPUI_FLEET_INPUT_OK\n'` produced the marker in the selected pane.
- Read-only captures from the private tmux socket confirmed the first session
  stayed at its initial prompt and only the second received the command. See
  `selected-terminal-input.png` and `tmux-pane-captures.json`.
- F1 returned Home. F5 → Manage saved machines opened the native management dialog.
- A disabled fixture was enabled with Return. The row changed to Disable and a
  separate process read the canonical saved registry with `enabled: true`.
- Return disabled it again. The row changed to Enable and a second independent
  registry read returned `enabled: false`. See the machine screenshots and
  `registry-enabled.json` / `registry-disabled.json`.

The controller used isolated HOME, configuration, daemon and tmux socket paths.
The saved fixture's SSH alias targeted only loopback port 9 with a one-second
connection timeout; its expected disconnected state does not prove successful
remote SSH connectivity. Production sessions and the separate Showcase recording
demo were untouched. Scratch launch scripts/state remain under
`.tasks/gpui-fleet-live-v2/`; private environment state is deliberately not committed.

## Limits

This successful fresh-process run does not explain the earlier native QA input
failure. No claim of same-process recovery, real remote terminal acceptance,
restart restoration, narrow-window acceptance, full Home/F5 parity, release
packaging, merge or publication follows from these checks. Existing automated
source gate results remain in `../native-fleet-retry-2026-10-11/`; no source code
changed for this evidence slice.
