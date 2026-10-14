# Relocated standalone release negative qualification — 2026-10-13

Local macOS ARM64 only. Built the current standalone installer, relocated it outside checkout, and executed it with private HOME/TMPDIR and PATH=/usr/bin:/bin. Node24 was explicit. The 46,388,627-byte archive came from the current verified history alpha (source hashes in source.json), packaged with the maintained recipe. No candidate application executed and no user installation changed.

An owned loopback HTTPS endpoint served the exact manifest, Ed25519 signature and archive. The publisher key and locally trusted TLS CA were ephemeral test credentials, never a production trust root. All private keys/archive/extracted app/prefix were removed during cleanup; only small logs and hashes are retained.

The executable installer downloaded and extracted the authenticated archive, reached the real default Apple verifier, and rejected it. A transparent private --import hook observes child-process verification tools but forwards the same arguments and results without replacing tools or accepting anything. real-verifier-tools.json establishes successful sw_vers/spctl checks followed by actual /usr/bin/codesign exit1; rejection was therefore not malformed policy/archive. The public CLI correctly reports generic release failure with activationState unknown. Independent assertions proved the synthetic prior current pointer and payload unchanged and temporary staging empty.

A separate uninstrumented rejection invocation ran the relocated installer directly, without --import. It produced identical rejection JSON, exact manifest/signature/archive request order, unchanged prior pointer/payload and empty staging. The tool-observer run remains a separate diagnostic control.

A third invocation used the untouched relocated installer without the observer. After manifest/signature requests, the HTTPS server transmitted the archive's actual first1024bytes and held the remaining body. SIGINT then produced exit1/cancelled/not-attempted, with the synthetic prior and empty staging preserved. Exact request order includes the archive before cancellation.

The synthetic prior was created using the test-only injected verifier solely to establish a rollback-preservation sentinel. This is not a successful Apple-signed installation. The tested release candidate always used the real verifier. No Gatekeeper/signing policy was weakened.

The initial packaging preflight used an invalid output filename and was rejected before archive/network work; preflight-failure.\* retains that failure. first-pass.log used a synthetic partial body for cancellation; final.log supersedes it with the real archive prefix. Final receipt covers independent child/server/root cleanup. No external service, GUI, container, native build, production daemon, root CLI rebuild, commit or push occurred.

Run from the original private harness .tasks/gpui-standalone-release-local/run.mjs; this evidence copy records exact source and is not relocatable because its module imports are repository-relative. Signing/notarization, trusted publisher distribution and clean-machine positive install/update/rollback remain unqualified.

Exact local harness invocation (from repository root):

```sh
/private/tmp/tmux-ide-295-release-nkydyctm/bin/node .tasks/gpui-standalone-release-local/run.mjs
```

Installer SHA256: `17cf01adb3d2d46f2b8f9d56c603d4942974b3ec097edd022b621cbb0c0c21c1`. Both direct executable invocations use explicit Node24, relocated installer, `update --prefix PRIVATE --policy PRIVATE --version 0.1.0`; only the diagnostic invocation adds the transparent --import observer.
