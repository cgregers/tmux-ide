# Shared Home observer polling starvation

The actual scoped transport polls every five seconds. Previously those advisory
polls incremented the same revision as authoritative state invalidations. A read
settling after a poll lost its success or failure, and insertion-order scheduling
could continually restart the first two slots before later sessions ran.

The deterministic reproducer uses the actual scoped transport timer with controlled
six-second read completion. Before: two new failures, nine existing tests passed.
After: 27 tests passed across polling, TUI observer wrapper, transport and machine
agent tests, including a slow successful read, visible failure, later-session
service and genuine authoritative supersession. Before/after logs are retained.

The owner now distinguishes advisory refresh from authoritative invalidation.
An active read satisfies a routine poll. Least-recently-served slots receive fair
service. Actual state changes still advance revisions and reject stale results;
retirement, generation checks, abort handling and the two-read limit are unchanged.

Independent review approved the exact source hashes in source.json. Affected
consumers are TUI Home and shared machine agents used by TUI fleet and GPUI
Home/F7. The separate GPUI private-host/workspace observer is unaffected.

This establishes the polling failure/fix; it does not alone qualify the real
33-session GPUI journey. That investigation separately identified legacy session
discovery running during semantic subscriptions, starving catalog HTTP requests.
Native recovery, live fleet qualification and release readiness remain open.

Validation commands (repository root, Node24 on PATH):

```sh
pnpm --filter @tmux-ide/daemon exec vitest run src/lib/home-agent-observer-polling.test.ts src/tui/mirror/runtime/application-home-agent-observer.test.ts src/tui/mirror/runtime/application-home-agent-transport.test.ts src/tui/mirror/runtime/application-machine-agents.test.ts
pnpm --filter @tmux-ide/daemon run typecheck
pnpm exec eslint packages/daemon/src/lib/home-agent-observer.ts packages/daemon/src/lib/home-agent-transport.ts packages/daemon/src/lib/home-agent-observer-polling.test.ts
```

Types include the OpenTUI dock configuration and passed before the final test-only
slow-success control was added. Lint passed on all three files and was repeated
on the test after that addition. No product source changed after type checking.
