# Repeatable Home/fleet workflow qualification

The GPUI workflow now runs both maintained Home machine-filter/context and exact
empty-server selection/creation journeys. Linux uses source browser helpers and
the existing upstream tmux setup. macOS uses the app assembled earlier in the job
and a private patched tmux built from the repository provenance. Both build a
fresh CLI under repository .tasks so external dependencies resolve without
changing bin/cli.js. Bash pipefail propagates fixture failures; always-upload
steps preserve journey logs and the macOS tmux manifest.

Validation: parsed workflow with the repository js-yaml dependency, bash -n on
all extracted run steps, Prettier and git diff --check. Independently reviewed.
Executed the exact macOS journey step locally with GITHUB_WORKSPACE and a private
RUNNER_TEMP layout pointing at the existing qualified app and tmux bundle. The
step built a fresh private CLI and both journeys passed (attached JSON logs).
Artifact identities are retained in ../packaged-fleet-home-2026-10-11/.

This local check reuses existing artifacts: it does not claim the new hosted job
or Homebrew/pinned-tmux setup has run. No native GUI, production sessions, saved
profiles, user demo, root CLI, signing or publication was touched. Hosted checks
and remaining physical, remote and distribution acceptance remain open.
