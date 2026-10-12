# Bounded browser lifecycle probe

This opt-in probe checks the packaged browser bridge, not the native GPUI window.
It sends inactive presence before selection and requires a selected Workspace
snapshot with that presence acknowledgement and `inputReady:false`. After the
first ready publication, any publication losing that state fails the run. Browser
exit also fails. Success requires the full requested steady interval, followed by
successful cleanup; reaching initial readiness alone is insufficient.

Default isolated mode creates an owned scratch tmux server and daemon through the
existing fixture helper. Supply an already built private CLI and packaged app:

```sh
node --import tsx apps/tmux-gpui/scripts/browser-lifecycle-probe.mjs \
  --app '/absolute/path/Tmux IDE CI.app' \
  --cli '/absolute/path/private-cli.mjs' --duration-seconds 30
```

Use Node 24 and put the qualified tmux directory first in PATH. Nothing rebuilds
`bin/cli.js`. This mode may create and remove only its own fixture sessions.

Real-host observation is explicit and never starts or restarts a daemon. It uses
existing local discovery and saved fleet profiles. Provide exact published machine,
session and semantic pane IDs; labels and first-server/first-pane fallbacks are not
accepted:

```sh
node apps/tmux-gpui/scripts/browser-lifecycle-probe.mjs \
  --real-host --app '/absolute/path/Tmux IDE CI.app' \
  --machine-id 'published-machine-id' --session-id 'published-session-id' \
  --pane-id 'published-semantic-pane-id' --duration-seconds 60
```

Real-host mode sends only inactive presence and session/pane selection. It sends
no terminal input, resize, creation, deletion or restart commands. An ordinary
session attachment can still trigger the daemon's existing metadata promotion;
this is not a claim of globally side-effect-free access. Inactive presence avoids
claiming terminal input readiness or deliberately taking the foreground input lease.
Do not use this probe as evidence that active input or geometry authority works.

Duration must be explicit, 1–600 seconds. Initial readiness has a separate 60-second
bound. SIGINT/SIGTERM trigger bounded retirement of the exact browser child;
isolated mode also independently retires its daemon and scratch fleet. No process
name or personal server cleanup is used. SIGKILL/power loss cannot run cleanup.

Only phase/count/duration metadata is printed. Terminal cells, profile labels,
tokens, SSH targets, raw status/errors and child stderr are never logged. Framing
is bounded to 8 MiB per publication. The probe consumes and discards snapshot data
in memory. An idle open stream may remain silent; the steady interval proves no
observed readiness loss while the browser stayed alive, not a network heartbeat.

Repeated switching, GUI rendering/focus, resize gestures, reconnect recovery,
foreground input, remote interactive latency and clean-machine/signing acceptance
remain separate qualifications. Do not turn a successful read-only probe into a
claim of full native reliability.
