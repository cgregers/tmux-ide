# Packaged saved-machine Edit and Remove qualification

The release-mode native app was freshly built/assembled at native source6f879901
using the supported receipt-bound development assembly path. Exact binary, Node,
bridge and receipt hashes are attached. This remains unsigned and nonhermetic;
no native GUI was launched or user demo replaced.

machine-remove-process.test.mjs now accepts explicit TMUX_GPUI_TEST_APP. Supplied
empty/relative/missing app or invalid helper paths fail before private journey
allocation. The browser child uses bundled Node and browser.bundle.mjs, scratch
cwd and isolated HOME; no tsx/source fallback. Source mode is unchanged. The
canonical HTTP handler and registry are fixture-private; disabled profiles never
connect via SSH. Both Edit/Remove verify exact registry publication/file effects,
sibling and environment-pin retention and stale/background/pending duplicate
refusal. This is packaged bridge qualification, not physical native form proof.

The packaging script now includes this fixture in its existing explicit-app
Node test invocation, making both journeys repeatable in macOS packaging CI.
Local fresh assembly passed its original five checks; the expanded combined
invocation passed seven checks with no skips. Source two-case fixture, typecheck,
lint, invalid-package controls, bash syntax and diff checks passed. Independent
review attached. Expanded invocation:

    TMUX_GPUI_TEST_APP='/private/tmp/gpui-machine-edit-package-6f879901/Tmux IDE CI.app' node --import tsx --test apps/tmux-gpui/bridge/local-app.test.mjs apps/tmux-gpui/bridge/compatibility-process.test.mjs apps/tmux-gpui/bridge/machine-remove-process.test.mjs

The newer gate-script addition was validated against the freshly assembled app;
it did not trigger a second redundant native build. Hosted run38156832785 is for
prior head6f879901 and does not yet include this addition. Physical pointer/IME,
real SSH, signed distribution, clean-machine install/update and public release
acceptance remain open. Production sessions and bin/cli.js stayed unchanged.
