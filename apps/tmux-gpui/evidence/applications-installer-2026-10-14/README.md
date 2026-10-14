# Applications installer qualification — 2026-10-14

The original signed-archive journey installed and updated successfully, then uninstalled while retaining managed versions. Reinstall failed because the canonical transaction rejected an existing version when no current pointer existed. `before-receipt.json` preserves this failed real path and successful owned cleanup.

The repair permits detached reactivation only for the identical owned digest, freshly verifies the retained application, and rechecks directory identity, content, ownership record and rollback predecessor before activation. Different active versions and mutated retained copies remain refused; retained versions are not deleted as a workaround.

`after-receipt.json` records successful install, same-version update, uninstall, and reinstall in a fresh private HOME/TMPDIR with Node 24.21.0. The Applications symlink targets the stable managed `TmuxIDE.app`. A foreign Applications entry was refused while preserving it and the managed current pointer. Owned scratch cleanup passed. No application or daemon was launched, and no real user installation was changed.

The signed archive was downloaded from the existing public immutable release and passed the real signature verifier. **Only the unpublished `tmux-ide-install-v2.mjs` download was substituted with the locally built artifact**; its pinned SHA-256 check still ran. This proof does not claim public availability of the v2 installer or bootstrap.

Validation: the initial canonical regression failed 4 of 5 tests before repair; the final expanded installer/bootstrap suite passed 67 tests. Formatting, scoped ESLint, shell syntax and diff checks passed. Parent separately reports all 16 universal-dispatch tests passing; those dispatcher files are outside this artifact manifest.

- Standalone v2 SHA-256: `a3819360478f4231cdb68cfb7ce0802659ac94e3bc9b8722c06d260050759ccc`
- Native bootstrap SHA-256: `f867f6c1e881e3a821fdcb555a4b4c1b4291549a68a3e78b362577a6d8a71f6e`
- Public signed archive SHA-256: `c676bdec31f0cebf748e58e0538e3de0944eca825020a830f1eac15af64c2710`

`source-and-artifact-hashes.json` binds the four implementation/test files and generated standalone artifact. Local runner and detailed logs remain under `.tasks/gpui-applications-real-v2-2026-10-14/`; no large artifact or terminal contents are included here.
