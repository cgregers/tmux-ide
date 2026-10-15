# Application wheel delivery

The published alpha routed every native wheel gesture to local history. Mouse-reporting alternate-screen programs consequently received no wheel reports. Native events now retain pane-local coordinates and modifiers; the bridge follows the TUI mouse-protocol encoder, preserving wheel counts, Shift history override and request/input authority.

Before: published alpha delivered zero application wheel bytes in the isolated real-PTY fixture. After: three up and two down gestures delivered exactly 50 SGR bytes at column 5, row 3; Shift stayed local, stale request was refused, pane identity and fixture cleanup passed. `bridge/browser-wheel-smoke.mjs` retains the executable reproducer.

All three focused native wheel event tests pass, including fractional accumulation, request transitions, selected-pane coordinates, modifiers and interrupted-input gating. The user confirmed the freshly built local preview resolved their reported scrolling problem on 2026-10-14. This is not a claim of every application/protocol or second-Mac verification.

Intel runtime history qualification is independently unresolved and deferred by the user. Native distribution targets Apple Silicon only.
