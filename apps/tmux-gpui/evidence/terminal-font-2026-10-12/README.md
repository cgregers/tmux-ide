# Native terminal font settings

F5 Terminal font offers installed family selection and size controls. Reuses Herdr FontConfig and automatic installed-symbol fallback resolution. Separate tmux-ide gpui-fonts.json persistence; no Herdr config mutations. Shared metrics cover paint, IME, selection, scrolling, headers, divider drags and daemon resize. Font changes cancel stale geometry operations.

Independent review approved after fixing async appearance/discovery overwrite and captured divider height. Focused 244 passed. Both Clippy configurations, formatting, file size and full workspace suites passed. Totals (passed, failed, ignored):

tests-default: (2924, 0, 10)

tests-all: (2958, 0, 17)

Initial full gate found field_reassign_with_default; corrected without suppression. Physical font rendering/save/restart and exact package verification remain pending. Native font harness syntax/lint and isolated cancellation control passed.
