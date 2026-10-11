# F7 fleet attention qualification

Implementation: the native F7 popover shares the existing fleet observer with
Home. Opening and dismissing observation preserve the underlying terminal. Rows
use the daemon attention flag and current opaque route, scope and revision.
Private-host helpers report unavailable fleet coverage.

Submitting Enter requests navigation. An invalid/stale request is rejected while
preserving the current terminal; an admitted request begins ordinary fleet
navigation. Dismissing observation does not undo already submitted navigation.
Newer navigation and foreground/presence fences remain authoritative.

## Evidence so far

- Final default workspace: 2866 passed / 10 ignored. All features: 2900 passed /
  17 ignored. Both Clippy configurations, formatting and file-size checks passed.
- Full bridge gate: 333 passed / 5 explicit skips; typecheck passed.
- Private real-daemon two-pane fixture: open/close/reopen observation, stale
  open/close commands, live terminal input, unchanged pane identity and sizes passed.
- Review found missing Live/Partial action gating and stale action retiring the
  existing terminal. Corrections passed independent source review and the final gates above. A maintained
  real-daemon smoke test additionally proved exact rejection acknowledgements for
  invalid scope/revision/key without changing the live terminal.
- Native light-theme QA: Home F7 showed two attention rows from supported fixture
  @agent_state stamps. Enter opened the exact blocked pane and became input-ready.
  F7 over another live workspace selected the observed agent in Native playground.
  Popup paste was absent from all four owned panes; outside dismissal over another
  session did not navigate; real tmux pane dimensions stayed byte-identical.
- Initial QA launch copied the upstream herdr-gpui executable instead of the
  tmux-ide-gpui executable; its CLI correctly refused the browser flag. The fixture
  cleaned up, the correct freshly built executable was copied, and QA relaunched.
- F7 narrow/dark/OS-IME qualification is incomplete: a resize attempt made no
  change, then UI automation reported user interaction. Stopped UI actions and
  left the QA window running. No packaging, remote SSH or release claim.
- Unpromoted-session attention rows were displayed disabled until ordinary
  session opening established their native identity. This is truthful existing
  admission behavior; direct attention activation of such rows remains a gap.

The user's current demo is the previous validated 40aa5442 native build, with
90606cf5 startup delivery correction in its private daemon. It is untouched by
this qualification fixture.
