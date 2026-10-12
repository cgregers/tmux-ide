# Installed launcher version pinning — 12 October 2026

A deterministic executable regression found a real race in the generated launcher. It calculated app_macos via logical cd/pwd through the mutable installed TmuxIDE.app -> current alias. After the old Node executable started, update could redirect its helper/native arguments to the new version; rollback did the inverse. Detach removed the paths required by the pending launch. Before:3/3failed, including exact NODE_one/HELPER_two/NATIVE_two output.

The minimal owner fix is physical directory resolution with cd -P and pwd -P in assemble-local-app.mjs. Subsequent executable paths refer to the retained version directory. This does not change install verification, signing policy, transaction semantics or version retention.

The maintained regression extracts the actual assembly launcher template, installs version-distinct inert executables into an isolated private prefix through real installApp, pauses after Node begins, and performs real update/rollback/detach. It checks the existing child remains alive, all executable markers come from one version, later stable launches select current, and direct retained launch survives detach. Includes paths with spaces and direct-launch control. The positive verifier is injected only in this test; no signing bypass was added to the public installer. This is a shell/transaction executable-path proof, not LaunchServices or signed-install acceptance.

Validation:31/31focused transaction/recovery/launch tests; full bridge gate432passed,5optional skips; lint/diff clean. Independent review approved exact assembler/test hashes in artifacts.json. Fresh standard unsigned development assembly revalidated the existing native binary/source receipt, rebuilt bridge and generated notices; all8package checks pass. No native rebuild was claimed. No QA app was launched, user preview replaced, or production tmux touched.

Remaining: physical paste/IME, native scroll/copy/resize, clean-machine signed installation/update and public release qualification. This closes the reproduced version-mixing race, not the whole GP10 card.
