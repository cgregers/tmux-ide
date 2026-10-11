# TUI to GPUI parity checklist

Current priority: full TUI parity with a coherent native design system is the next
delivery goal. Proper icons, buttons, tabs, pane headers and sidebars are part of
parity acceptance, not a later cosmetic pass. Embedded browser and VS Code follow
this milestone; they must not displace missing TUI workflows.

Scope corrected by the user on 11 October 2026: the current TUI no longer includes
Files/editor or Changes. Do not implement those surfaces for parity or count them
as v1 blockers. The remaining product scope is fleet management and Home/F5
workflows. Preserve and regression-test the working terminal foundation, then
complete packaged-app and release qualification. Embedded browser/VS Code and
other earlier expansion ideas are deferred beyond this v1.

## Acceptance rule

For each item, record the TUI trigger and result, native implementation, automated
test, physical comparison and commit. Use the same isolated daemon/session fixture
for both clients. Exercise keyboard and pointer paths, normal and narrow windows,
unavailable data and stale selections. Keep daemon ownership and existing contracts;
GPUI owns presentation, not a second source of terminal or fleet truth.

## 1 Native shell and navigation

Present: Home/Terminals, session sidebar, window strip, pane headers, switcher and theme picker.
The first F5 slice adds searchable Home, Switch session, Appearance and Refresh
commands using the existing picker. It has keyboard/input-isolation tests and
physical light/dark verification. The centered palette design and full TUI action
vocabulary remain unfinished. Shared icon tabs and sidebar buttons landed in
`2b83924c`; see `evidence/native-controls-2026-10-11/` and `evidence/native-f5-2026-10-11/`.

- [ ] Match TUI information hierarchy: machine, session, window, pane and agent status.
- [ ] Match Home search, machine filter, All/Working/Needs attention and jump-to-agent workflows.
      Native Home now filters loaded agents by name/session label and All/Working/Needs
      attention, preserving coverage, unavailable rows and identity/revision fences.
      Headless tests and physical light/dark checks are recorded in
      `evidence/home-filters-2026-10-11/`. Broader team/project/machine search, machine
      filters, keyboard shortcuts and remaining physical acceptance stay open.
- [ ] Complete sidebar show/hide, grouping, overflow, long labels and keyboard navigation.
- [ ] Add full command palette with the TUI action vocabulary and contextual availability.
- [ ] Match help, shortcut reference and relevant user-facing connection diagnostics.
- [ ] Physically compare Home and Terminals at normal size and 640×400; no clipped controls.

## 2 Sessions windows and panes

Present: local discovery, selection, new sessions, pane rename/zoom/split and daemon-owned resizing.

- [ ] Complete pane close with confirmation and correct next-selection behavior.
- [ ] Audit every TUI window/session action, including new terminal window, against native controls.
- [ ] Verify external tmux changes immediately update selection, names, counts and layouts.
- [ ] Verify continuous horizontal/vertical resizing, minimum sizes, nested splits and zoom restoration.
- [ ] Verify DPI/fractional geometry and competing-client authority denial/restoration.
- [ ] Ensure every action targets the captured live identity and cannot affect a replacement pane.

## 3 Terminal interaction

Present: live multi-pane output, keyboard/paste, bounded history, selection and copy.
Physical full-visible-pane Unicode copy has exact-byte evidence; broader selection remains open.

- [ ] Qualify ordinary keys, modifiers, application shortcuts and terminal key forwarding.
- [ ] Qualify IME commit/cancel across focus loss, pane switching and denied input.
- [ ] Compare wheel/trackpad scrolling, history navigation and return-to-live behavior with TUI.
- [ ] Qualify historical selection, Unicode/soft-wrap boundaries and resize/topology invalidation.
- [ ] Audit TUI mouse reporting, alternate-screen scrolling, links and search; implement matching reachable behavior.
- [ ] Verify alternate-screen apps, cursor-only updates, colors, decorations and wide characters.
- [ ] Ensure no discarded input is replayed following disconnect or stale target recovery.

## Removed legacy scope

Files/editor and Changes are not current TUI surfaces and are excluded from this
milestone. External VS Code behavior already present must remain correct; building
an embedded editor, Git Changes UI or new integration is not required for v1.

## 6 Remote machines and agent activity

Native preview is primarily local; a local demo does not qualify fleet parity.

The Node connection owner is now reusable through
`@tmux-ide/daemon/connection-owner` (`createDaemonConnectionOwner`). The TUI retains
its telemetry adapter and consumes the same owner; the public subpath brings in
no TUI modules. This is a Node-only API and does not belong in host-neutral clients.

The bridge now has a tested `remote-route.ts` adapter that borrows one verified
SSH epoch, rejects stale inventory, and cancels on retirement. The browser now
accepts a private SSH machine file through `host-source.ts`, reuses the shared
owner on Home refresh, and clears its catalog/input/child when the route retires.
An isolated process fixture covers connection, refresh and disconnect; real SSH
and physical remote-terminal acceptance remain pending. A centered native SSH
dialog is available through F5, with a Local action that cancels pending discovery.
The bridge now exposes lazy local-registry read/save/edit/enable/disable/remove
commands using the shared daemon-owned persistence path. Stale revisions and
overlapping writes are rejected; uncertain replies are reconciled without replay.
UUID-based bridge routing landed in `50dd355c`. The native F5 saved-machine
picker now reads the shared registry, searches labels/SSH targets and submits the
captured UUID/revision; stale, disabled and unavailable rows cannot connect.
Dedicated headless checks cover selection fencing, command serialization, Escape,
input isolation and a failed read queue. The native Connect form now attempts a local save before dialing, preserves
existing saved UUID/pins, and reports an explicitly temporary connection when
persistence cannot be confirmed and no conflicting profile exists. Late save
results cannot reconnect after navigation cancellation. Native edit/enable/disable/
remove controls and physical saved-picker/Add acceptance remain pending.
Reuse SavedMachineSchema and scoped clients;
never import the Solid navigation singleton or implement a second SSH stack.
Cancellation, child cleanup, sanitized failures, generation mismatches and late
completion after a machine switch must remain fenced through the native adapter.

- [ ] Native add-machine/SSH flow and machine/session grouping.
- [ ] Match retry, disconnect, unavailable-machine feedback and identity conflict diagnostics.
- [ ] Match remote session/pane selection, output, input and geometry authority.
- [ ] Match agent status, attention counts, search/filter and jump-to-pane behavior.
- [ ] Keep remote editor behavior explicit; never open a remote path as a local folder.

## 7 Settings and persistence

Present: theme picker. This is not the complete TUI settings surface.

- [ ] Verify all tmux-ide themes, accent colors and persistence across restart.
- [ ] Match notifications, quiet hours, updates/background refresh and crash-restore settings.
- [ ] Match keyboard reference and reset-to-defaults behavior.
- [ ] Match selection/layout restoration where supported, with live identity revalidation.

## 8 Native design acceptance

Use the TUI for product structure and Zed/Herdr for native interaction quality.

- [ ] Establish shared native design tokens: semantic colors mapped to all tmux-ide themes,
      typography, spacing, radii, borders, elevation and focus states.
- [ ] Build reusable Icon, IconButton, Button, Tab, PaneHeader, SidebarRow, Menu,
      Tooltip, Dialog and StatusBadge components; migrate existing chrome to them.
- [ ] Use one attributed SVG icon family with consistent optical size/stroke,
      accessible labels and tooltips; keep agent/product logos separate from action icons.
- [ ] Add a component gallery with light/dark, disabled, hover, selected and keyboard-focus specimens.

- [ ] Compact pane headers with title, selected state and discoverable contextual actions.
- [ ] Coherent tab strip, overflow and tooltips; distinguish app sections from tmux windows.
- [ ] Consistent spacing, typography, icon sizes and restrained status indicators.
- [ ] Correct titlebar/traffic-light alignment and useful translucent materials with readable contrast.
- [ ] Visible divider hover/drag state, keyboard focus and accessible control labels.
- [ ] Avoid permanent diagnostic text occupying normal workspace space; expose details on demand.
- [ ] Compare normal/narrow, light/dark, focused/unfocused and empty/loading/error specimens.

Zed references: its [panel system](https://zed.dev/blog/new-panel-system) separates
panes from docked panels and supports zoom; its [terminal documentation](https://zed.dev/docs/terminal)
shows panel versus center placement, tabs, scrolling and a breadcrumb toolbar.
Adapt these patterns to tmux-ide's Home/Terminals structure. Do not add Zed's entire
editor feature set to the parity milestone. Inspect the license of each source file
before any code reuse; Herdr's license does not cover Zed code.

## 9 Distribution acceptance

- [ ] Latest native and impacted daemon CI green, plus exact packaged-app checks.
- [ ] First launch can establish supported daemon connectivity without developer setup.
- [ ] Signing/notarization and clean-machine install, update, rollback and removal verified.
- [ ] Publish explicit supported capabilities and remaining limitations.

## 10 Embedded browser and VS Code

Deferred future product ideas, explicitly outside the current v1 milestone. The external VS Code
launcher does not satisfy this requirement. See [upstream research](HERDR-DESIGN-RESEARCH.md).

- [ ] Adapt Herdr browser tabs and native webview lifecycle to native workspace groups.
- [ ] Handle webview focus, resizing, overlay occlusion, navigation and close correctly.
- [ ] Embed VS Code web as a tab or side panel using the selected live workspace context.
- [ ] Adapt server discovery/supervision, loopback token authentication, readiness,
      failure/retry and shutdown; preserve explicit user acceptance of server terms.
- [ ] Keep browser/editor tabs client-owned and distinguish them from tmux windows/panes.
- [ ] Verify session switches, server exit, app exit and overlays without leaking
      terminal input or opening a stale/remote path as a local folder.

## Execution order

1. Complete fleet management: saved-machine list, add/save/edit/remove,
   enable/disable, selection and recovery, preserving daemon ownership and identity.
2. Complete Home/F5 workflows against the current TUI: machine grouping/filtering,
   agent attention/navigation, relevant commands and native dialogs/shared controls.
3. Run regression checks for the existing terminal/pane/window behavior and qualify
   real local/remote workflows without risking production sessions.
4. Complete packaged-app, install/update and preview-release acceptance.

Keep each implementation card narrow. Existing GP03–GP08 acceptance remains open
where its required evidence is missing. Older checklist items outside fleet/Home/F5
are historical audit ideas, not automatic scope additions or v1 blockers. Performance
comparisons remain a separate measured workstream.

## Source map

- TUI action inventory: `packages/daemon/src/tui/mirror/workspace/application-action-descriptions.ts`,
  `application-command-description.ts`, `pane-action-menu-model.ts`.
- TUI native-surface targets: `packages/daemon/src/tui/mirror/features/{home,files,changes,settings,rich-preview}`
  and `runtime/application-machine-*.tsx`.
- GPUI baseline and limits: `apps/tmux-gpui/README.md`, `INTEGRATION.md`, `VALIDATION.md`.
- GPUI native action implementation: `upstream/crates/herdr-gpui/src/tmux_snapshot/pane_actions.rs`.


## Zed reference for native machine workflows

Inspected Zed main at `93d745668805029476e6d7fbb19652116fed51de` (11 October 2026).
Use these concrete patterns when completing native machine controls:

- A shared modal header/body/footer, with scroll confined to the body and stable
  action placement. Apply to Connect, Save/edit machine and removal confirmation.
  Source: [modal components](https://github.com/zed-industries/zed/blob/93d745668805029476e6d7fbb19652116fed51de/crates/ui/src/components/modal.rs).
- Distinct list, server-options, edit and connection states. Keep saved UUIDs as
  authority; labels are display/search text. A connection form should not double
  as an implicit Save operation.
  Reference: [remote server modes](https://github.com/zed-industries/zed/blob/93d745668805029476e6d7fbb19652116fed51de/crates/recent_projects/src/remote_servers.rs).
- A shared modal owner that captures previous focus, focuses the dialog, and
  coordinates dismissal. For tmux-ide, restore the previous valid focus without
  replaying input or accidentally granting terminal authority.
  Source: [modal layer](https://github.com/zed-industries/zed/blob/93d745668805029476e6d7fbb19652116fed51de/crates/workspace/src/modal_layer.rs).
- Explicit disconnected presentation with a named target and deliberate recovery
  action. Adapt this to our shared connection-owner states and sanitized errors;
  never copy Zed's remote-server startup behavior into tmux-ide implicitly.
  Source: [disconnected overlay](https://github.com/zed-industries/zed/blob/93d745668805029476e6d7fbb19652116fed51de/crates/recent_projects/src/disconnected_overlay.rs).
- Build dialogs, rows, buttons, icon actions and tab treatments from consistent
  native primitives instead of one-off styling. Verify keyboard/pointer parity,
  long labels, narrow windows, focus loss and pending-operation cancellation.

These are implementation/design references, not completed acceptance items.
No Zed application code was copied. Its `ui` crate declares GPL-3.0-or-later;
GPUI declares Apache-2.0. Keep source provenance explicit for any future reuse;
existing Herdr-derived controls and tmux-ide theme tokens remain our starting point.
