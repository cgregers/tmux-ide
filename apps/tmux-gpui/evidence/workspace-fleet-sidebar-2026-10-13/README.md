# Workspace fleet sidebar — in progress

This native slice projects the existing bounded machine/server/session fleet
publication and reuses opaque route and preference capabilities. It does not
add daemon intelligence or a persistent full-fleet agent observer. The existing
selected-workspace agent section remains separate.

## Evidence preserved so far

- Two initial compiler failures concerned module paths/helper visibility and a
  borrowed status string in an owned GPUI element. Logs are preserved.
- `request-fixtures-before.log`: 283 passing, three failing existing selection
  tests. Their constructors set browser_request7 while publication.request
  defaulted to0. Production apply_browser_state admits matching requests only.
  Valid fixtures were aligned; the stronger dispatch guard was preserved.
- `focus-ack-before.log`: 288 passing, one failing newly added collapse/ACK
  keyboard test. Rotating the preference capability cleared full-target focus.
- `direct-ack-pass.log`: 289 passing after redraw-only machine focus rebinding.
  This predates the additional realistic Saving-phase regression coverage and
  must not be presented as final qualification.

Independent review then identified that Saving publications remove executable
preference capabilities before Ready returns. Stable machine focus must survive
that interval independently of a valid action token. Old pointer callbacks and
exact session/server identities must remain rejected when stale. Review also
requires conservative current-catalog retention when active server identity is
unknown, rather than treating two absent server IDs as a proven shared scope.

No final source freeze, full workspace gate, release build or native physical
acceptance is claimed by this draft. The previously qualified alpha2026101308
remains separate and has not been replaced. Production sessions are untouched.

## Saving repair result

`saving-focus-before.log` preserves the one-test failing reproduction against
the old owner: after Saving removed the collapse capability, Ready could not
restore focus and Right emitted no expansion command. The repaired owner keeps
only canonical machine focus through Saving; executable selection is None until
a Ready redraw binds a fresh capability. Session/server identities stay exact.
`focused-final.log` records 289 passing focused tests, including the same Saving
sequence, stale publication rejection and conservative unknown-server retention.
Independent source review found no remaining blocker; final hash binding and
broad workspace qualification remain pending.

## Broad gate result

Both strict Clippy configurations, format and file-size checks passed.
Workspace results: {'default': {'passed': 2969, 'failed': 0, 'ignored': 10}, 'all': {'passed': 3003, 'failed': 0, 'ignored': 17}}.
Commands were `cargo test --locked --workspace` and the same with
`--all-features`, using pinned isolated Rust homes, single-job compilation,
CARGO_INCREMENTAL=0 and an empty HERDR_BUILD_PR_NUMBER. All 12 source hashes
match the independent approved freeze. Native physical acceptance remains
pending; this supersedes earlier broad-gate pending statements.
