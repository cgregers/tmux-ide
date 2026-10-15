# Remote connection route adapter — 11 October 2026

The native bridge can borrow one ready SSH epoch from the shared daemon connection
owner. It verifies the unauthenticated and authenticated identities using the
existing SSH verifier, selects exactly one online tmux scope, and invalidates on
owner retirement or parent cancellation. Disposing a route removes its observers
without disposing the machine transport. Remote hosts never gain local-editor proof.

Validation: 21 Node tests passed across remote-route, discovery and local-editor;
bridge TypeScript check, changed-file ESLint and Prettier passed. Review corrected
mutable caller option ownership; its regression now passes. Initial fixture failures
are retained: the capabilities fixture had extra strict-schema fields, and the
multiple-server fixture reused an ID. These were test setup errors, not product
reproductions. Observer callback fixture typing was also corrected to match the owner.

Commands:

- `node --import tsx --test apps/tmux-gpui/bridge/{remote-route,discovery,local-editor}.test.ts`
- `pnpm exec tsc -p apps/tmux-gpui/bridge/tsconfig.json`
- `pnpm exec eslint apps/tmux-gpui/bridge/remote-route{,.test}.ts`

Scope: helper tested with controlled owner/network fixtures, not yet integrated into
browser.ts or native UI. No real SSH/platform acceptance claimed. Next wire route
retirement to catalog/child cleanup and expose native machine dialogs. No production
sessions or existing user preview touched. No release or full parity claim.
