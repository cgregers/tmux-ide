# Native session history controls — 13 October 2026

F8 and Shift-F8 consume bridge-owned opaque Back/Forward capabilities. No native
history ledger or cached session route is added. Optional fields keep older
helpers compatible. Exact rejected tuples leave current request/frame intact;
accepted new-request publications move the view through the existing loading path.
A shared request allocator covers ordinary navigation, F5, F7 and history so
rejected attempts cannot reuse IDs. Held keys, composition, modals, pending
navigation and unacknowledged/background presence do not leak F8 to terminals.

Independent source review approved all23 frozen files (14 fixture initialization
updates included). Initial compile failure reused an existing scroll-history test
module name; that file was restored unchanged and new decoder tests separated.
Focused final294 tests passed; an equivalent identical-branch OR cleanup after
that run is covered by the broad gates on the frozen source. Format, file-size,
both strict Clippy configurations and both workspace test modes passed. See
checks.json for exact totals and raw logs for existing ignored tests.

No native visual or real browser/daemon history acceptance is claimed yet.
Bridge integration and its isolated daemon test remain in progress. Synthetic
native rejection/Back/Forward harness is prepared and reviewed separately, but
not yet run against a release build. Alpha09 is unchanged. Local work only.
