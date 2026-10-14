# Local Linux runner — 2026-10-13

A local Docker Desktop Linux ARM64 container built the private CLI from clean
commit `e4b4e368` and passed the new-window and browser-history journeys. Both
processes exited 0. Receipts and exact output are alongside this file.

Tests used no network, no host mounts, two CPUs, 768 MiB memory, a 256-process
limit and a 120-second timeout. The fixtures reported source identity preserved
and successful cleanup. Production sessions and credentials were not mounted.
The image build downloads public dependencies; this is a local runner, not an
offline build. No GitHub push or hosted CI job was triggered for these checks.

## Reproduce

From the monorepo root, create a clean source snapshot and copy this recipe:

```sh
mkdir -p .tasks/gpui-linux-local/source
git archive e4b4e368 | tar -x -C .tasks/gpui-linux-local/source
cp apps/tmux-gpui/evidence/local-linux-runner-2026-10-13/Dockerfile .tasks/gpui-linux-local/Dockerfile
docker build --progress=plain -t tmux-ide-gpui-local:e4b4e368 .tasks/gpui-linux-local
```

Run each journey in its own disposable container:

```sh
docker run --rm --network none --cpus=2 --memory=768m --pids-limit=256 tmux-ide-gpui-local:e4b4e368 timeout --signal=TERM --kill-after=10s 120s node --import tsx apps/tmux-gpui/bridge/new-window-smoke.mjs
docker run --rm --network none --cpus=2 --memory=768m --pids-limit=256 tmux-ide-gpui-local:e4b4e368 timeout --signal=TERM --kill-after=10s 120s node --import tsx apps/tmux-gpui/bridge/browser-history-smoke.mjs
```

## Limits and setup findings

This checks the TypeScript bridge and daemon on Debian ARM64 with upstream tmux
3.7c, not the native macOS GUI, supported patched tmux, or Ubuntu x64. One passing
new-window run does not resolve the previously observed hosted intermittent
failure. Browser-history success does not prove native mouse range selection.

The first build exhausted the local Docker engine's approximately 1 GiB memory
while installing the entire workspace. A second restricted installation omitted
workspace packages imported directly by the CLI. The successful recipe selects
root dependencies plus all packages, excludes unrelated applications/docs, limits
pnpm heap/concurrency, and caches the package store. Docker settings were not
changed. Build-attempt logs remain in local `/tmp/gpui-linux-local-build*.log`.

The base Node image and package registries are not digest-pinned; `receipt.json`
records the exact image used here. Rebuilding later is a fresh qualification,
not a guarantee of identical image bytes.
