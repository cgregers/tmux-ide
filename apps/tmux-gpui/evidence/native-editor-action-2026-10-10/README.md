# Native selected-pane editor action

Native pane menu sends an explicit captured OpenEditor request. Bridge resolves live
cwd using authenticated daemon API, with verified local-discovery provenance, fresh
canonical record/identity/local process checks, selected pane/foreground/revision
checks at awaits, and one pending action plus token replay refusal. Launcher is
fixed /usr/bin/open -b com.microsoft.VSCode with an absolute directory argv; no shell.
Explicit private hosts receive fixed unavailable guidance and do not read context.
Failure guidance requires reselecting the pane before retrying.

Independent review approved native three files and frozen six bridge files.
8 native pane-action tests passed, all-target/all-feature package Clippy passed,
format/file-size passed. 12 focused bridge tests passed. Full bridge 268 passed,
5 optional packaged-app tests skipped. Source real-daemon browser smoke passed:
stale request ignored, explicit host refused, selection and pane text unchanged,
navigation after replay and isolated cleanup. Logs have trailing whitespace removed.

Physical mouse invocation and successful VS Code launch are NOT verified. Native
release executable build is in progress; user demos still run earlier artifacts.
No signed release, merge, production change, or new demo claim.
