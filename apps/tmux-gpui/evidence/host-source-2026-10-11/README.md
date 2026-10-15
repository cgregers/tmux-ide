# Native browser SSH host source — 11 October 2026

The native browser accepts a private machine file with a shared-schema sshTarget
and optional expectedEnvironmentId. It uses the existing shared connection owner
and verified remote-route. Home refresh reuses the transport. Route retirement
clears catalog, sessions, selection and input, retires the owned terminal child,
and fences late host/session results. App shutdown disposes the owned transport.

Validation:

- Full bridge gate: 283 passed, 5 skipped (platform/app-dependent); includes bridge
  TypeScript checking and bundled payload/notice checks.
- Isolated browser process test: fake SSH executable supplies a controlled daemon
  identity and scoped HTTP catalog through the real transport owner and guarded
  relay. Connect succeeds; Home refresh opens no extra transport; transport exit
  publishes unavailable, empty selection and no terminal input. Browser exits cleanly.
- Source tests use the actual shared owner and route with controlled transport and
  HTTP responses, covering reuse, target changes, disposal and late completion.
- Changed-source ESLint and formatting passed.

Independent review found late publication gaps across host/session reads; route
revision and captured catalog checks now fence them. Review also hardened process
test failure capture, bounded output and cleanup. Initial failures retained here:
TypeScript caught a redundant dispose after narrowing catalog to undefined; the
first process fixture selected an older publication without matching its request.
These are implementation/test iteration evidence, not field bug reproductions.
Log trailing whitespace was normalized for repository hygiene.

Limits: empty-catalog process fixture, not real SSH authentication, remote terminal
input/resize, native machine dialog, physical macOS or other-platform acceptance.
Existing user preview and production sessions were untouched. No release claimed.
