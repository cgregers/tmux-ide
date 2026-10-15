# Fleet-wide native Home agent integration

The local native browser now composes the same machine-agent observer as the TUI,
borrowing the fleet catalog and manager. Observation is foreground Home only;
private host-file and Workspace observation retain their previous paths.

The existing native roster wire remains bounded to 256 rows. Opaque keys privately
bind machine, session route and observed agent/native identity. Display labels
include the machine. A stale key cannot resolve through a replacement route.
Opening re-reads the exact server/session shell and compares agent, semantic pane,
native identity and interaction endpoint before opening. Request, presence and
route fences survive asynchronous work, including the final helper preparation.
No first-pane fallback is permitted for an agent click.

## Evidence

- Bridge typecheck and full gate: 327 passed, 5 packaged checks skipped.
- Seven new tests cover duplicate IDs across machines, stale route/source before
  publication, global row/target bounds, removed rows, loading/unavailable/partial
  states, fresh target replacement and cancellation during delayed inventory and
  route verification.
- Focused ESLint passed.
- Live isolated daemon/tmux process smoke records real shared Home observation,
  fleet session promotion, input readiness and return Home in live.log.
- No Rust source or native wire fields changed; Rust gates were not rerun.

## Limits

Live smoke uses the existing CLI bundle and source bridge, not a freshly packaged
release. Live semantic agent clicks across real SSH hosts and the final file-I/O
presence race are not physically qualified by these checks. Per-host observation
bounds do not establish one global read concurrency budget. No card is closed,
no merge/release is performed, and user-controlled demo windows are untouched.
