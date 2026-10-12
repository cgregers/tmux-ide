# Native terminal font settings

F5 Terminal font offers installed family selection and size controls. Reuses Herdr FontConfig and automatic installed-symbol fallback resolution. Separate tmux-ide gpui-fonts.json persistence; no Herdr config mutations. Shared metrics cover paint, IME, selection, scrolling, headers, divider drags and daemon resize. Font changes cancel stale geometry operations.

Independent review approved after fixing async appearance/discovery overwrite and captured divider height. Focused 244 passed. Both Clippy configurations, formatting, file size and full workspace suites passed. Totals (passed, failed, ignored):

tests-default: (2924, 0, 10)

tests-all: (2958, 0, 17)

Initial full gate found field_reassign_with_default; corrected without suppression. Physical font rendering/save/restart and exact package verification remain pending. Native font harness syntax/lint and isolated cancellation control passed.

Packaged release build succeeded and all 10 exact-package checks passed (zero skips). Native inspection showed Menlo 14 → 15 and family changes to Courier New and back to Menlo. The first physical run was invalidated by an extra operator Escape reaching the private terminal. The repeat showed a runtime-failure diagnostic and an empty terminal; save/restart verification remains incomplete. This is not a qualified native persistence or rendering result. The repeat harness was sent SIGTERM for its owned cleanup. Production sessions and the installed user Alpha were not changed.
