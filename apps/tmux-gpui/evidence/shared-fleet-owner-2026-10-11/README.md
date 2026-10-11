# Shared machine connection manager

Extracted the existing TUI manager to daemon lib for native fleet integration.
The manager body is unchanged modulo names/whitespace. Shared import constructs
no singleton and imports no TUI module. The TUI adapter retains its old exports,
telemetry default, singleton and compatibility initialization entry.

Blast radius: 27 daemon source consumers reference the old module; they retain
that path and symbols. Native consumers can use the Node-only daemon subpath
`@tmux-ide/daemon/machine-connections`. No wire change or protocol schema change.
The native catalog does not yet consume the fleet manager: this is shared ownership
groundwork, not multi-machine Home completion.

Checks: 28 existing authority/catalog/startup tests and 25 navigation/agent tests
passed; native direct-import test preserves the other live host when disabling
one route and disposes owned transports. Full bridge gate 300 passed, five skipped;
daemon TypeScript build, focused ESLint, format and diff checks passed. Compiled
package self-reference loads successfully from packages/daemon. A first import
attempt from the root failed because the root has no daemon dependency link; the
package-scoped export check corrected that test setup.

Independent reviewer approved import/lifecycle compatibility. No physical fleet
GUI, real SSH, release or performance claim. Production sessions and recording
Showcase remain untouched.
