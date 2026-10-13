tmux-ide native alpha 0.1.0, build 2026101302

Local unsigned Apple Silicon test build. Requires macOS 14.2 or later and
a separately installed, running tmux-ide daemon on the destination Mac.
This ZIP bundles the native client, Node runtime, bridge, icon and notices.
It does not install or replace your daemon or terminate tmux sessions.

Extract the ZIP and open Tmux IDE Preview.app. Keep the previous preview
for rollback; closing the app leaves terminal sessions running. This is
not a signed/notarized public release or a qualified clean-machine installer.

Changes: historical mouse selection and Cmd-C now copy wrapped Unicode
without enabling terminal input. Native before/after verification passed,
including zero terminal bytes and source survival. Default/all-feature
Rust gates and all 10 packaged checks passed.

The new F5 Help work is not included. Source commit f3adec3a.
Use receipt.json and SHA256SUMS to identify the exact archive.
