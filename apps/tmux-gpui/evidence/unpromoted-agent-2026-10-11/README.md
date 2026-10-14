# Agent selection before ordinary-session promotion

Reproduced against branch 0705f52e source bridge and the private CLI bundle
containing 90606cf5. Explicit scratch HOME/daemon/tmux server; all fixture children
were stopped and the scratch root removed. User demo windows were untouched.

## Trigger and result

Create an ordinary unregistered tmux session. Set the supported pane @agent_state
to blocked. Observe Home/F7 before opening that session: the agent appears but is
disabled. Open the session through normal fleet selection, then observe again:
the row becomes available. Raw authenticated application-shell snapshots show:

- Same liveSessionId before and after.
- Before: terminal.discovered resource, missing-semantic-stamp, no native identity
  or interaction endpoint, and an agent ID derived from that discovered resource.
- After: a different pane.promoted resource and agent ID, with an authenticated
  pane interaction endpoint and paneLifetimeId.

This is a missing admission mapping, not a label, rendering or focus error.

## Ownership and next implementation

application-shell.ts derives the discovered ID from session/native runtime facts.
WorkspacePromotionAuthority stamps promoted semantic IDs. NativeTmuxSessionOpener
returns only workspaceName/liveSessionId, so the bridge has no trustworthy old→new
pane correspondence. A renderer-side availability relaxation is insufficient:
GPUI fresh-target checks correctly reject the changed semantic IDs, and the
pre-promotion session descriptor may also lack workspaceName.

Implement targeted admission in the daemon: bind the observed opaque resource to
the exact server generation, live session and native pane lifetime/membership;
promote through the existing owner; revalidate that same physical pane and return
its promoted semantic target. Then use the ordinary GPUI exact-pane path. Keep
existing proven native/interaction identity matching strict. Names, indices and
labels cannot be fallback authority.

Required controls: multiple identically named agents; exact intended pane after
promotion; pane removal/replacement and session replacement during admission;
server-generation change; stale/replayed observation; competing navigation and
background input denial; fresh workspace alias after admission. Read-only Home
observation must not itself promote or stamp sessions.

The TUI uses attach-then-check policy but compares the original agent and pane IDs.
Its source is not proof that it handles this transition; no physical TUI success
or failure is claimed. Two independent source audits agreed on the missing
contract. No product code was relaxed in this investigation.

## Re-run

Use Node 24, tsx and a qualified tmux directory on PATH. Supply an explicit private
CLI bundle (do not overwrite generated bin/cli.js):

```sh
TMUX_GPUI_TEST_CLI=/absolute/private/cli.mjs node --import tsx apps/tmux-gpui/evidence/unpromoted-agent-2026-10-11/reproduce.mjs
```

This is a diagnostic/control fixture: exit zero means observations, established
session-open recovery and cleanup succeeded; it does not mean direct agent
admission is fixed. The observed.jsonl file preserves the actual transition.
