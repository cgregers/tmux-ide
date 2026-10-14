# Semantic subscription discovery correction

On 2026-10-11, a private 33-session Home observer repeatedly failed to finish its
initial 32-session coverage. The daemon's semantic WebSocket subscription handler
called `discoverSessions()` once for each subscribed session. That synchronous
full-fleet discovery was unused: only legacy initial snapshots consumed its
result. Subscription membership was already unconditional.

The narrow correction moves discovery inside the existing legacy initial-snapshot
branch. Semantic resource-interest acquisition, authorization, acknowledgement,
replay, and subscription membership are unchanged. Legacy snapshots still verify
that the session exists and use the existing snapshot builder.

## Focused regression and checks

All commands ran from the worktree root. The new regression subscribes to 32
sessions in semantic mode, checks zero legacy discovery calls, and verifies
resource-interest acquisition, acknowledgement, and release. Its legacy control
checks an existing session's initial snapshot and rejection of a missing session's
snapshot.

Before the correction, this command exited 1 with 32 unexpected discovery calls
(`before.log`). The legacy control passed:

```sh
pnpm exec vitest run packages/daemon/src/lib/__tests__/ws-events-subscription-discovery.test.ts
```

After the correction, this command exited 0 (`after.log`):

```sh
pnpm exec vitest run packages/daemon/src/lib/__tests__/ws-events-subscription-discovery.test.ts packages/daemon/src/lib/__tests__/ws-events-protocol.test.ts packages/daemon/src/lib/__tests__/ws-events-agent-status.test.ts packages/daemon/src/lib/__tests__/ws-events-fleet.test.ts
```

Vitest reported **84 passing executions over 8 paths**. These are **42 unique test
cases across 4 suites, executed twice** because an existing diagnostic directory's
`packages` symlink points to the repository's same packages directory. The before
run likewise reports the same failure and passing legacy control twice. These
counts do not represent independent duplicate coverage.

Both following commands exited 0. Their retained logs are empty because successful
execution produced no output:

```sh
pnpm exec eslint packages/daemon/src/command-center/ws-events.ts packages/daemon/src/lib/__tests__/ws-events-subscription-discovery.test.ts
pnpm --filter @tmux-ide/daemon exec tsc --noEmit
```

## Private process comparison

A new CLI was built separately; generated `bin/cli.js` was not changed:

```sh
node scripts/build-cli.mjs --outfile .tasks/gpui-home-recovery/candidate/cli.mjs
```

The existing private CLI and rebuilt CLI ran the same uninstrumented recovery
smoke with the same current bridge/observer sources. Each run created and cleaned
its own private daemon and 33 one-pane tmux sessions. The old CLI timed out with
only 8 sessions currently observed (`old-cli-live.log`, exit 1); the rebuilt CLI
completed (`new-cli-live.log`, exit 0). The earlier deterministic regression
isolates the subscription defect; the live comparison qualifies the complete
current private source stack, not an otherwise identical release artifact.

```sh
TMUX_GPUI_TEST_CLI=/Users/thijs/.codex/worktrees/retire-web-desktop/tmux-ide/.tasks/gpui-agent-admission/candidate/cli.mjs PATH=/private/tmp/gpui-split-promoted-eg12r6nf/bundle:/private/tmp/tmux-ide-295-release-nkydyctm/bin:$PATH node --import tsx apps/tmux-gpui/bridge/home-recovery-smoke.mjs
TMUX_GPUI_TEST_CLI=/Users/thijs/.codex/worktrees/retire-web-desktop/tmux-ide/.tasks/gpui-home-recovery/candidate/cli.mjs PATH=/private/tmp/gpui-split-promoted-eg12r6nf/bundle:/private/tmp/tmux-ide-295-release-nkydyctm/bin:$PATH node --import tsx apps/tmux-gpui/bridge/home-recovery-smoke.mjs
```

The successful journey observed 32 sessions, used Load more to reach 33, retained
its F7 subscription, and preserved the browser connection/request and native
session/window/pane IDs, pane PIDs, geometry, and semantic stamps. No session was
promoted. Cleanup completed before success was printed.

The recovery smoke depends on the separate Home recovery implementation and is
**not included in this WebSocket source checkpoint**. `identity.json` records its
exact external source hash and both private CLI hashes for attribution. These
private paths are historical run inputs, not installed release prerequisites.
This evidence does not qualify native GUI behavior, remote machines, failed-read
Retry recovery, performance, or memory bounds. Native physical evidence belongs
to the separate Home recovery qualification.

`identity.json` binds the two changed WebSocket source/test files and all retained
logs. Logs have only per-line trailing whitespace and blank lines at EOF normalized; original and archived
hashes are both recorded.
