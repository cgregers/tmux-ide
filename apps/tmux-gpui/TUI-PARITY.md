# TUI to GPUI parity checklist

Current priority: full TUI parity with a coherent native design system is the next
delivery goal. Proper icons, buttons, tabs, pane headers and sidebars are part of
parity acceptance, not a later cosmetic pass. Embedded browser and VS Code follow
this milestone; they must not displace missing TUI workflows.

Baseline: 11 October 2026, GPUI branch `codex/tmux-gpui-bootstrap` at `fceac5a4`.
The native terminal foundation works, but the native application is not yet a full
equivalent of the TUI. Full parity includes the surrounding workspace, Files/editor,
Changes, fleet, settings and keyboard workflows. A preview release is a separate,
smaller milestone. Unchecked items include both missing work and incomplete acceptance.

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
  First slice can filter loaded agents by name/session label and existing status/attention
  fields without a bridge change. Preserve roster coverage, unavailable rows, opaque
  identities and revision fences. Broader team/project/machine search needs additional
  published data; session cards should not disappear under an agents-only filter.
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

## 4 Files and built-in editor

Missing as a native workspace surface. “Open folder in VS Code” is an external-editor
action and does not satisfy this section.

- [ ] Native Files tree with TUI filtering, expand/collapse, changed-file navigation and selection.
- [ ] Native file tabs and editor/read-only surfaces matching TUI capabilities.
- [ ] Match open/save, dirty-buffer prompts, binary/large-file handling and permission errors.
- [ ] Match pane/project context changes without showing or saving to a stale project.
- [ ] Match supported rich previews with explicit unavailable/unsupported states.
- [ ] Qualify external VS Code launch from the selected local pane's current directory.

## 5 Changes and integrations

- [ ] Native Changes view matching TUI repository/file status and diff navigation.
- [ ] Inventory and port each reachable TUI Git action with the same confirmations and error behavior.
- [ ] Verify repo/worktree switching and refresh against the selected live workspace.
- [ ] Track requested Herdr GitHub integration separately from TUI parity; specify its actions before porting.

## 6 Remote machines and agent activity

Native preview is primarily local; a local demo does not qualify fleet parity.

Next machine slice: make the existing Node SSH transport/authority owner reusable
outside TUI internals, with TUI behavior preserved. The native adapter should reuse
SavedMachineSchema, runtime supervision and scoped clients; it must not import the
Solid navigation singleton or implement a second SSH stack. Test cancellation,
child cleanup, sanitized failures, generation mismatches and late completion after
a machine switch before exposing the Add machine dialog.

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

Explicit native product scope, beyond the TUI parity baseline. The external VS Code
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

1. Establish native tokens, icons and shared controls; migrate shell/sidebar/tabs
   and complete the palette/action inventory.
2. Finish pane/window controls and terminal correctness acceptance.
3. Add Files/editor and Changes as native workspace surfaces.
4. Complete fleet, agent workflows, settings and persistence.
5. Run full side-by-side acceptance and distribution gates.

Keep each implementation card narrow. Existing GP03–GP08 cards retain their current
preview acceptance; this checklist expands the full-parity target without declaring
those cards complete. Performance comparisons remain a separate measured workstream.

## Source map

- TUI action inventory: `packages/daemon/src/tui/mirror/workspace/application-action-descriptions.ts`,
  `application-command-description.ts`, `pane-action-menu-model.ts`.
- TUI native-surface targets: `packages/daemon/src/tui/mirror/features/{home,files,changes,settings,rich-preview}`
  and `runtime/application-machine-*.tsx`.
- GPUI baseline and limits: `apps/tmux-gpui/README.md`, `INTEGRATION.md`, `VALIDATION.md`.
- GPUI native action implementation: `upstream/crates/herdr-gpui/src/tmux_snapshot/pane_actions.rs`.
