# Isolated switching and recovery probe

Run with Node 24, a qualified tmux on PATH, an absolute packaged application, and
an existing private CLI bundle (the probe never rebuilds `bin/cli.js`):

```sh
node --import tsx apps/tmux-gpui/scripts/browser-switch-recovery-probe.mjs \
  --app '/absolute/Tmux IDE Preview.app' --cli /absolute/private/cli.mjs \
  --cycles 3 --hold-seconds 5
```

This tool has no real-host mode. It scrubs ambient selectors and creates its own
scratch HOME, discovery record, daemon, tmux socket, session and two windows.
It selects each exact published pane repeatedly, checks selected snapshot and
input-authority readiness throughout each hold, then stops its owned daemon.
A newer publication must clear the frame and input authority and report the
canonical transport-closed diagnostic. The same browser process must recover
through explicit Refresh after a new owned daemon instance starts. Fresh catalog
identities must match both original targets; no first-pane substitution is used.

Success is printed only after independent cleanup completes. Evidence contains
phase metadata, not terminal cells, tokens or labels. Native pane IDs, processes,
birth IDs must survive unchanged. Geometry is baselined after initial session
adoption (which enables top borders), then must survive switching and restart unchanged. The probe sends presence and
navigation only, never terminal input or resize. Ordinary attachment may stamp
owned session metadata. A ready input capability is not proof of input delivery;
native GUI switching, rendering and user input require separate qualification.
The hold checks every received publication and child EOF, not a daemon heartbeat.
