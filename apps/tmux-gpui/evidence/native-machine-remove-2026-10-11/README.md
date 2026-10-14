# Native saved-machine removal

F5 Manage saved machines exposes Remove with a separate confirmation showing the
captured label and SSH destination. Confirmation uses UUID, registry revision,
browser request, foreground state and its own modal identity. Retained Confirm
and Cancel callbacks cannot act on a replacement confirmation. Queue acceptance
latches submission but does not remove rows; authoritative registry publication
reports the result. Uncertain replies stay unreplayed and can be refreshed.
Remote sessions are not stopped by this registry operation.

Independent review caught a same-target cancel/reopen callback race before commit;
per-modal identity and a regression corrected it. Focused native checks: 211 pass,
including rendered headless pointer/keyboard, stale/background and queue refusal.
Bridge gate: 356 pass, 5 optional skips. The new private browser process test uses
the actual canonical HTTP registry handler with two disabled private profiles;
it verifies stale/background admission, one pending write, exact removal and
unchanged sibling persistence. Manager-level coverage separately verifies route
retirement and sibling handle/epoch preservation. No real SSH qualification is
implied. Registry revision is local preflight, not daemon-side atomic CAS.

The initial focused log path was accidentally shared by two agents; that mixed log
is excluded. This directory contains the independently named final reruns. Native
physical light/dark/narrow/IME acceptance is pending while the user uses an older
demo. No user window, real saved profile or production session was manipulated.
Full native workspace suites passed (2,891 default / 2,925 all-feature tests;
10 / 17 pre-existing ignored checks), both Clippy configurations, formatting,
source-size check and debug build passed. Exact binary hash is in build.json.
