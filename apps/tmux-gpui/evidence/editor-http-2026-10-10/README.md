# Scoped pane editor context HTTP verification

Authenticated POST read and typed client; no native editor launch is wired yet.
Independent review approved nine frozen production/test files and the live fixture.
Fixture-only final lint correction qualifies fetch/AbortSignal through globalThis.

Real isolated source-built daemon: authenticated cwd read matches tmux; read leaves
pane text unchanged; no bearer rejected 401; body generation mismatch rejected 409;
live cwd with spaces/Unicode returned; disposed client rejects; private cleanup passed.

Initial live failure was fixture setup: macOS sh C-locale readline mangled typed
Unicode. Preserved failure and diagnostic show an unclosed shell quote. Setup now
uses an ASCII glob confined to the fresh project, then compares the exact Unicode
native cwd and API observation. This does not qualify Unicode keyboard input.

Focused: contracts 2, daemon 33, client 11 passed; affected typechecks/lint passed.
Bridge: 263 passed, 5 optional packaged-app checks skipped. No GUI or signing claim.
Directory belongs to daemon host; consuming native launch must independently prove
locality and reject stale selection. User demos and production sessions untouched.
