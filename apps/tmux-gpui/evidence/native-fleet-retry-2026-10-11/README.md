# Retry a disconnected fleet machine

TUI owner reference: application-machine-sidebar.tsx and
application-machine-navigation.ts use the shared machine manager retry operation.
Native Home and F5 now expose the same operation for disconnected SSH groups.
Opaque retry tokens bind the displayed handle and endpoint epoch, retire on
replacement/removal/recovery, and are consumed before calling the owner. This
action does not select a session, replay terminal input or write the registry.

Seven focused bridge tests passed, including recovery of one machine while
healthy siblings and selected machine remain unchanged, consumed/stale token
rejection, profile replacement and removal. The complete bridge gate passed
317 tests with five packaged checks skipped. The original test assumed immediate
connecting state; the retained failure was corrected by awaiting the owner ready
publication, not by changing connection scheduling.

Review found a full-queue error hidden by live Home rendering. Retry now leaves
F5 open with an error; the Home button opens the same error surface. Initial Rust
private-field qualification failure is preserved; the method moved to the picker
owner rather than exposing its internals. Final Rust gates: **2838 passed / 10 ignored** default; **2872 passed / 17 ignored** all features. Both Clippy configurations, format, source size, focused ESLint and native debug build passed.

Real native pointer/keyboard activation and real SSH recovery remain unqualified.
This is branch work, not a release or mission-card completion.

## Native rendering and keyboard submission

An isolated presentation fixture with no SSH transport displayed the Home Retry
button and the F5 Retry machine action. Native F5 → type retry → Return filtered
and submitted exactly the expected fleet-retry command (native-commands.json).
Screenshots record dark Home and filtered F5. The fixture did not acknowledge F1,
so Loading selection in these images is fixture behavior, not a claimed daemon
response. The shared-owner bridge tests, separately, prove fixture recovery.
No actual SSH recovery, Home-button pointer action, light/narrow layout or full
Home multi-input interaction is qualified by this presentation test. The native
child was terminated by its exact PID and the private HOME removed.

## Controlled native input comparison

The follow-up presentation fixture enabled Home agent search alongside F5: typing
retry still worked. With `--home-search --with-sessions --updates`, it additionally
published unchanged catalog metadata every 200 ms; F6 → type Workspace retained
focus and query (f6-home-search-updates.png). This rules out those factors alone
in this fixture. It does not explain or erase the original real-bridge QA typing
observation. No speculative production input change was made. Each comparison
child was terminated by exact PID and its isolated HOME removed.
