# Retained session tabs — in-progress acceptance

Base commit c3e36e5c. Source remains uncommitted pending acceptance.
The first isolated real-daemon journey passed two accepted tabs, stale refusal,
retained activation and inactive close, then failed active close because an agent
observation refresh rotated tab capabilities. The preserved trace shows the
healthy terminal remained intact. A deterministic captured-close → observation
refresh → admission test failed before the owner repair and passed afterward.

Action identity/revision now bind retained identities and navigation lifetime;
view-only activity/availability updates repaint without invalidating actions.
Activation still requires fresh exact target resolution; removed/replaced targets
and stale request/revision remain fenced. Focused tests: 32 passed. Full bridge:
511 passed, 5 optional skips, typecheck and lint passed. Independent final review
and same-path real-daemon rerun remain pending. Native acceptance is separate.

The preserved real fixture must run from .tasks/gpui-retained-session-tabs/run.mjs
for relative imports. It requires explicit isolated CLI/Node/tmux inputs, never
personal daemon discovery. No terminal input or resize is sent. No session-kill
operation is issued by the app; fixture cleanup retires only its owned server.

Final independent review approved all eight bridge source hashes. The unchanged
real fixture reran against the frozen repair and exited 0: accepted tabs, stale
refusal, retained activation, both close paths, original pane identities and
owned cleanup all passed. This is source-bridge/real-daemon proof, not native GUI
or packaged proof. No blind retry or fixture assertion change was used.
