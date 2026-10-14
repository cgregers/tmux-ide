# Hosted docs and formatting failures — 12 October 2026

Exact head7e5e499a CI run38212238174 exposed stale TUI demo source fingerprints and13unformatted tracked GPUI docs/evidence files. Docs job114688779794 and CLI22job114688779895 logs are excerpted here. These are genuine hosted failures, not green from local focused bridge checks.

Ran supported pnpm demo:tui: all3productionframes/9figures regenerated, rendered bytes unchanged, only two authority-adapter fingerprint entries changed. Independent node docs/scripts/check-tui-demo.mjs passes. Full pnpm docs:build passes uncached1/1. No manual hash stamping.

Ran repository Prettier on exactly13trackedCI-listed files. Independent review verified every formatting result matched formatting HEAD before the separate reviewed readability correction: literal paste payload placed in inline code to avoid Markdown emphasis. Three evidence JS scripts have unchanged logic. Scoped format check passed. Protected bin/cli.js remains excluded/unchanged.

Changes are local branch fixes; hosted rerun is pending. GPUI Linux failure in a separate in-flight fleet verification path is being investigated independently. No app release or production restart.
