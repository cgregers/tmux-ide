# Exact packaged Home/fleet bridge qualification

A fresh cached release-mode native build and receipt-bound development app were
assembled from source head96e1ecc6. The app is unsigned/unreleased and was not
opened. The packaging gate passed five artifact/compatibility tests, generated
notices and independently checked the native executable/receipt. This is local
source consistency, not trusted attestation or clean-machine qualification.

Both maintained real-daemon fixtures now accept explicit TMUX_GPUI_TEST_APP.
Supplied empty, relative or missing app paths fail before scratch allocation.
Packaged mode requires bundled Node and browser.bundle.mjs and runs with private
scratch cwd, without tsx or source fallback in the browser child. Source mode is
preserved. Independent review approved the two exact hashes; syntax/lint/diff
checks and six invalid-path controls passed.

Source and exact-package runs both passed:
- Two genuinely empty duplicate-label servers; exact second-server selection and
  one creation there, first still empty and source identity/geometry/stamps intact.
- Home/F7 metadata and machine select/clear, stale revision refusal, same connection,
  no promotion and unchanged source identity/geometry/stamps.
Both fixtures clean only their owned children and sockets. Explicit private CLI
and qualified tmux are still test dependencies; this is not standalone daemon
installation or real remote SSH acceptance. The saved-machine removal process
fixture still has source-only coverage and is not qualified by these results.

App: /private/tmp/gpui-fleet-package-96e1ecc6/Tmux IDE CI.app.
Hashes and build/assembly/package/live receipts are retained here. Native GUI,
physical light/dark/narrow/IME, signing/notarization, clean-machine install/update
and public download verification remain open. User demos were untouched.
