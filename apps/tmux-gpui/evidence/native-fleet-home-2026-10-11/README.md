# Native fleet Home integration — incomplete physical qualification

These results concern uncommitted branch work on `codex/tmux-gpui-bootstrap`,
based on `69748e64`. They do not qualify a merged or released application.

## Automated evidence

- Bridge suite: 312 passed, 5 skipped (`bridge.log`).
- Rust workspace: 2831 passed, 10 ignored (`workspace.log`).
- Rust all features: 2865 passed, 17 ignored (`all-features.log`).
- Clippy all targets with all features and without default features, source-size
  check and debug native build passed (corresponding logs).
- Real isolated local bridge process selected a fleet row, promoted the session,
  opened a pane with input ready, and returned Home (`local-process.json`).
- A separate capture from the same isolated daemon produced 17 publications;
  all 17 passed the Rust Reader (`captured-wire-decode.log`). The permanent
  startup fixture retains initial, connecting, ready and final Home messages
  with anonymous session display names. This is protocol evidence, not proof
  that the native UI applied those messages.

The permanent captured-startup regression passed (`startup-regression.log`).
The broad Rust gates above predate this test-only addition.

## Retained failures and limits

Initial bridge failures are preserved. Fixture-key expectations and compatibility
startup waiting were corrected. The bounded-retirement/unconsumed-output failure
later passed, but its intermittent cause is not established or fixed.
The initial Rust test qualification error is preserved separately.

The new native QA window remained on Loading sessions. Its executable SHA-256
matched the freshly built binary:
`29c1d32bd5a60083f42c04c0d3cdd40f10359b0f3af794dc64e6aff45570d4e9`.
A process sample confirmed its browser reader thread was alive in read_until.
The actual QA bridge and viewer remained alive during inspection. A second
read-only bridge against the same isolated daemon published both selectable
sessions, and its messages decoded successfully. These observations rule out
neither an original-helper startup problem nor a UI application problem.

An attempted click on Refresh failed with the desktop automation error
`noWindowsAvailable`; inventory still listed the QA app as running. No restart
was used to hide this failure. Visible Home selection, native F6 selection,
long-label/narrow layout and physical input remain unqualified for this increment.
Helper SIGTERM also emitted `Native browser connection failed`; clean helper
shutdown is not claimed. The user's separate recording showcase was preserved.

## Existing-process follow-up

Read-only macOS Unix-socket counters showed 610688 bytes delivered from helper
48227 through launcher 48225 to native viewer 48226, with zero receive queues.
The native command direction showed 87 bytes delivered back through the launcher
to the helper. These counters establish original-stream traffic, not message
contents or a rendered Home result. The native reader remained alive.

Independent read-only review found no demonstrated decoder or foreground-gating
defect. Reader failure would end that thread; accepted Home mailbox updates are
not gated on foreground state. A debugger attach did not complete and was
cancelled; no debugger-derived state is claimed. CUA could still obtain the
window image but repeated clicks failed with noWindowsAvailable. The user was
asked to manually activate and refresh this same QA window. No product change
was made to conceal or bypass this unresolved observation.

## Same-process native observation after keyboard activation

After rebinding CUA and sending F5, the same original QA application displayed
Your fleet, Local Connected, and both sessions. Escape showed the full Home
including the agent summary; F6 opened the two-row fleet picker. No native or
bridge restart occurred. Saved image: activated-fleet-picker.png.

Pointer interaction still returned noWindowsAvailable. Return, Down and text
input did not visibly change this picker, so terminal selection/input via this
UI is NOT qualified. The prior Loading observation no longer describes the
currently visible Home, but no cause or code fix is established. This executable
predates the later machine-toggle source additions; no toggle UI is claimed here.


## Fleet picker closes on typing — reproduced and corrected

The captured fleet-only Home state exposed a deterministic UI defect: F6 opened
the picker, but the SearchInput Changed event called refresh_picker, whose legacy
sessions/panes emptiness guard dismissed it. The native manual observation was
ambiguous; this is a distinct proven headless reproduction, not a claim that all
native input behavior is qualified.

The guard now checks the unfiltered actionable navigation rows, including fleet
sessions. The same F6 → type Two → catalog publication → Enter path passes:
search stays focused, filters to one row, emits no terminal input, and sends the
exact fleet selection token with request 8. Independent read-only review approved
the fix and regression. Failing and passing logs are retained alongside this note.

In the original live QA process, Home and the two-row F6 picker subsequently
appeared; a terminal also opened. The timing/order of injected input was unclear,
and unexecuted text appeared in the disposable shell. No successful physical
keyboard-routing or persistence qualification is claimed from that observation.

## Final combined source gates

After the picker fix and machine management additions: workspace default
**2835 passed / 10 ignored**, all features **2869 passed / 17 ignored**. Both
Clippy configurations, format, source size and bridge (**315 passed / 5 skipped**)
passed. See final-*.log. Log trailing blank lines are normalized only. These
checks do not replace physical fleet navigation, SSH, machine-persistence or
packaged/release verification.
