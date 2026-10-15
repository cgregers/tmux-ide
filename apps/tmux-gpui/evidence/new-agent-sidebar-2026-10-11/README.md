# New agent and sidebar visibility

Source implementation adds the TUI's runtime sidebar preference to the native
client: application-bar panel-left icon, unmodified F10, and a dynamic F5
Show/Hide sidebar action. Home retains its sidebar-free layout. The existing
viewport path resizes the terminal; no new daemon geometry policy was added.

The native regression verifies 224 pixels of reclaimed terminal width, retained
pane selection/request/input-interruption state, resize-only bridge traffic,
pointer and F5 interaction, modified/held keys, IME composition, and stale menu
actions behind a newer dialog. Independent review prompted the composition and
stale-dialog guards before approval. The first compile failure is preserved;
the repaired focused suite passed 225 tests. The workspace suites passed
2,905 default-feature tests (10 ignored) and 2,939 all-feature tests (17 ignored).
Clippy then requested a semantics-preserving let-chain collapse in the new
sidebar guard; that diagnostic is retained with the follow-up checks.

The accompanying New agent dialog reuses the canonical create-pane owner action
with Claude/Codex harness metadata and a new-window placement. Both isolated
real-tmux journeys executed only private inert harness stubs, verified exact
metadata and single invocation, selected the new pane, and exercised input.
No personal harness was launched. Bridge checks passed 390 tests with five
explicit skips, plus TypeScript and lint.

CI also exposed an existing discovery publication ordering defect: Home became
unavailable before its loading text was replaced. The before-fix regression
observed this exact inconsistent publication. Installing guidance before the
synchronous roster publication fixes it; the real discovery/replacement journey
also passed using an explicitly selected private CLI.

The manifests and independent reviews describe the validated source. These are
source/headless and isolated bridge proofs, not physical UI, signed packaging,
or released-build qualification. Existing user demo windows remain on their
previous build and were not replaced by these checks.

Final checks: both Clippy feature configurations, three post-format sidebar
regressions, and the debug executable build passed. No native window was opened
for this change; visual acceptance and fresh packaged qualification remain open.
