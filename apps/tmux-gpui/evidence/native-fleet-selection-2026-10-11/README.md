# Native fleet projection and selection ownership

`bridge/fleet.ts` composes the shared machine catalog with an explicitly supplied
connection manager. It borrows the manager and owns/disposes only its catalog.
No implicit local discovery or application singleton is introduced. The adapter
is not wired into browser.ts or the Rust wire decoder yet; no user-facing fleet
parity, real SSH or physical acceptance is claimed.

Publication caps 64 groups, 128 sessions per group and 512 sessions globally,
reports omissions and copies only display fields and opaque selection tokens.
Credentials, endpoint addresses and free-form diagnostics do not cross this
projection. Session labels are bounded. Ready scoped sessions alone can select.
Selection tokens bind handle identity, epoch, daemon identity, server generation,
live session and workspace. Returned selections additionally bind navigation
revision and the manager's selected epoch: A→B→A cannot revive old async work.

Four tests exercise real shared manager/catalog ownership with controlled
transports and per-machine catalog snapshots: duplicate names, private-field
omission, detached publications, unavailable→live token retirement, label edits,
profile replacement, global limits and borrowed-manager survival on disposal.
Independent review approved after the selection lifetime fence. The reviewer
also identified the away/back hazard addressed in the final implementation.

Final bridge TypeScript and test gate: 305 passed, five skipped. Focused ESLint,
Prettier and git diff whitespace checks passed. No Rust files changed. The five
skipped external-app checks remain unqualified. Recording Showcase was untouched.

Next: supply an isolated/production-appropriate manager from the native browser,
add the strict Rust fleet wire model and grouped Home/F5 navigation together,
then validate actual multi-machine discovery and native interactions.
