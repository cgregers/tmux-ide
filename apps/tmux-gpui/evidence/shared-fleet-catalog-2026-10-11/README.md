# Shared Home and machine catalogs

Moved the existing TUI Home and multi-machine catalog implementations into daemon
lib. TUI adapters retain selected-machine discovery, singleton ownership, factory
overrides and existing exported names. Shared machine catalog requires an explicit
manager. Node-only `@tmux-ide/daemon/machine-catalog` exports the shared factory;
its import creates no TUI singleton and imports no TUI modules.

Independent review normalized both bodies and confirmed only names, imports and
injected defaults differ. Critical assumptions: sessions remain scoped by machine,
stale host data cannot be selected, and one failed host cannot hide healthy hosts.
The native headless integration fixture exercises these with two controlled
connection owners and catalog publications, then verifies catalog disposal.
It is not real SSH/discovery or physical native fleet verification.

Checks: 42 existing Home/machine catalog, navigation and agent tests passed; full
bridge TypeScript/test gate 301 passed/five skipped; daemon TypeScript build,
compiled export loading, focused ESLint, formatting and diff checks passed.

Next: compose the native fleet owner and publish bounded credential-free machine
groups to native Home/session navigation with exact-route selection. No user-visible
fleet feature completion, card closure, merge or release in this extraction.
