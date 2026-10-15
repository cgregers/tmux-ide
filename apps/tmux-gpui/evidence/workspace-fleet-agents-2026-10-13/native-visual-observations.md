# Native visual observations, 13 October 2026

Qualified optimized binary SHA256:
`64e9cc90e1d53347ad367bab98c0a8f62932fb073aa7cf8809117a9d45a876d3`.
Build source commit `33109b26`. Owned QA child 74018 exited 0, fixture exited 0.

Observed via CUA screenshots: Fleet agents heading, 2/3 sessions coverage and
omission note; duplicate agent rows with Machine A/B context, Working spinner and
Needs input status; A initially selected. Clicking the B row produced exactly
one scoped command for agent-b. Result showed Accepted Session B in the title,
Accepted Machine B window and pane, B selected and A unselected. Coverage stayed
visible. Cmd-Q closed the child. No terminal input or resize was sent.

Long labels ellipsize in the 224-point sidebar; this check does not qualify all
narrow layouts. Screenshots were inspected inline, not saved as image artifacts.
The raw receipt deliberately leaves its visual flag false; this separate operator
record supplies visual observations, without altering the raw fixture output.

First run supplied fleet:null alongside fleet agents and therefore exercised the
session-only fallback. It failed the selection oracle and exited after owned
cleanup. The corrected fixture supplies an empty valid fleet catalog, matching
production owner publication; independent review approved that sole correction.
Both fixtures and receipts are preserved. No product change was made for this.

Ctrl-G was used as the known tool activation aid. This is not normal Finder-launch
qualification, a real daemon GUI test, remote qualification, or signed installation.
