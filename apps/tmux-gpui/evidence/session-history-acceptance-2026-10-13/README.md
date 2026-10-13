# Session history acceptance — 13 October 2026

Native source at b4ed0c99 built through the qualified local cached release wrapper.
Binary SHA256: bcf5697799abb534a09a2a744d70089ed4e3a425b87589420b0ec8e1d7cb9246.

The physical synthetic journey passed through the native window using CUA:
Ctrl-G activation aid, F8 rejection retained Current C title/window/pane and rendered
snapshot, second F8 displayed Accepted BACK B, Shift-F8 displayed Accepted FORWARD C.
Screenshots were inspected inline; no screenshot files are claimed. Cmd-Q exited 0.
The raw receipt verifies the exact three command tuples and cleanup. Its visual flag
remains false because the fixture itself cannot observe pixels; this note records
separate operator verification. No real daemon, input or resize in that fixture.
Normal Finder launch activation and remote paths are not qualified here.

The first real isolated daemon journey failed at the direction-action assertion
(line 253): latest.sessionHistory[direction] was null. The failed fixture and log are
preserved. Investigation must distinguish a publication race from product cursor
loss; do not treat the native synthetic pass as resolving that failure.

The metadata trace reproduced missing Forward at request 7. Catalog request 6 had
pending traversal actions disabled; Pane request 7 immediately reenabled Back only
while still Loading, before live acceptance. Forward remained absent after local
preferences returned Ready. This rules out an early preference-ACK observation.
Source explains the transition: successful catalog-only publication calls retire(),
which clears active; continuation incorrectly required active.catalogOnly. Thus
the pending traversal was cancelled and the new live frame became an ordinary visit.

## Repair and same-path verification

The controller now retains successful catalog proof bound to the request, canonical
session key, catalog object and presence revision. Matching Pane navigation consumes
that proof even though the metadata helper has retired. Navigation/cancellation
clears it; missing/replaced catalog or presence cannot continue an old traversal.
The exact repaired source hashes received independent review.

The same real isolated source-browser/canonical-daemon smoke then passed: default
local session visit, fleet visit, no catalog-only persisted visits, invalid history
action preserving the current live terminal, Back, Forward, canonical visit storage,
unchanged source pane IDs/PIDs/birth IDs and owned cleanup. No terminal input or
resize was sent. This is a local daemon integration check, not remote-host coverage.
Full bridge gate: 494 passed, 5 optional skips, 0 failed; TypeScript included.
Focused tests: 43 passed; scoped lint passed. Rust source did not change after its
recorded broad gates/build/physical checks. Public distribution is still unqualified.
