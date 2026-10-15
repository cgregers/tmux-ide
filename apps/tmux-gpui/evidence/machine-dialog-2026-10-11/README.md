# Native machine dialog and cancellable connection actions

2026-10-11, macOS ARM64 development build. Branch-only evidence, not release qualification.

The F5 menu now opens a centered native Connect to machine dialog and offers a local/cancel action. The dialog validates SSH aliases, user@host and bracketed IPv6, uses shared input focus/composition handling, and sends a typed request to the shared daemon connection owner. Selecting a machine retires stale session and terminal selection state.

Independent boundary review caught a cancellation gap: Home/Refresh could still await stalled discovery, blocking the subsequent Local command. All discovery entry paths now launch request-fenced asynchronous refreshes. The process regression drives stalled SSH → Refresh → Home → Local and requires the local result within three seconds. This is a correctness deadline, not a performance benchmark.

## Checks

- Bridge full gate: 284 passed, five skipped; TypeScript and packaged bridge checks passed.
- Process cancellation journey: three tests passed.
- Native focused tests: 138 passed.
- Default Rust workspace passed (native library: 2553 passed, seven ignored).
- All-feature Rust workspace passed (native library: 2584 passed, eight ignored).
- Both all-target Clippy configurations, formatting, source-size gate and changed-file ESLint passed.
- Independent boundary reviewer approved final request fencing, cancellation, composition guards and selection retirement.

## Physical macOS QA

Used only the disposable Machine QA app, private daemon host and isolated socket. Verified F5 opens the dialog, invalid target guidance, Escape/Cancel, light and dark rendering, and opening over a live two-pane workspace. The dialog sentinel stayed in its field; read-only captures of all four disposable panes contained neither sentinel. This is visual/capture evidence, not an input wire trace. Screenshots are retained here. Closed the QA controller normally and confirmed exit zero; the user's Polished Preview was preserved.

Debug binary SHA256: `04a18a1f1f621b88249c2e7aa7a6ebade0d646dd0a3a366207f73f55e6d3844e`.

## Remaining limits

No valid remote target was submitted during physical QA. SSH owner behavior uses a process fixture, not real remote machine qualification. Physical OS IME, narrow-window layout, Linux/Windows, and real remote terminal/resize remain unverified. Saved-machine persistence and fleet management are still pending parity work. This evidence does not close GP03/GP07/GP08 or establish full TUI parity.
