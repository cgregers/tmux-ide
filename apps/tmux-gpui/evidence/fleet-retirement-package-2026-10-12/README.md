# Fleet retirement fix in exact package — 12 October 2026

Source37596b9e assembled to a fresh standard unsigned development app. The assembler revalidated the existing native binary/source receipt, rebuilt the bridge, regenerated notices and included the physical-path launcher fix. Native binary was reused with a matching receipt, not claimed rebuilt. Exact artifact hashes are recorded.

All10package checks pass, no skips. The actual bundled Node/browser passed ordinary retirement, held-identity in-flight retirement, and active malformed-identity failure controls. Tests use private HOME/cwd, minimal PATH, no source fallback and no GUI launch. Bundle identity/receipt, launcher PATH isolation, invalid native receipt, compatibility, fleet edit/remove also pass.

The native physical application was not opened. This closes the exact-package validation gap for the source retirement fix; hosted Linux revalidation and physical paste/IME/resize/history remain open. Existing hosted run38212238042 is still on old head7e5e499a; its Linux job failed and its macOS job was confirmed live in workspace tests. No newer pushes while that job runs. Production sessions/user Compact Preview untouched. No signing or publication.

Tracked-file Prettier check passes using repository ignores, with symlinks omitted from explicit arguments (including the upstream CLAUDE.md link). This avoids unrelated untracked evidence and does not format protected bin/cli.js. An initial explicit-path invocation rejected that symbolic link; no source-format errors remained.
