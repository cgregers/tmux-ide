# src/server/

PTY bridge and terminal upgrade handlers used by the embedded daemon.

The standalone `tmux-ide server` entry point is retired. Use `tmux-ide app`,
or `tmux-ide --headless` for the authenticated canonical daemon. Its `/ws/pty/:id`
endpoint requires a daemon token.

See `plans/v2.5.0-protocol.md` for the wire protocol.
See `plans/v2.5.0-architecture.md` for the v2.5.0 design.

## Files

- `pty-bridge.ts` — node-pty bridge: spawn, write, resize, lifecycle, cleanup
- `ws-route.ts` — WebSocket route handler implementing the protocol
- `*.test.ts` — Vitest unit tests
