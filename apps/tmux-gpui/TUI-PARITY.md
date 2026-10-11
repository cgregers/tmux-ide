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
physical light/dark verification. F1 Home, F2 Terminals and F6 session search now reuse the native tab/picker
owners, and the F5 list exposes Terminals and shortcut labels. Modified function
keys remain available to the terminal. F5 now floats in a centered popover over the unchanged view; shared control sizing
and theme treatments are consistent. F6 now shares this popover. Fleet-wide F7 is implemented and undergoing native
qualification; full TUI action vocabulary remains unfinished. See `evidence/native-f5-popover-2026-10-11/`. Shared icon tabs and sidebar buttons landed in
`2b83924c`; see `evidence/native-controls-2026-10-11/` and `evidence/native-f5-2026-10-11/`.

- [ ] Match TUI information hierarchy: machine, session, window, pane and agent status.
- [ ] Match Home search, machine filter, All/Working/Needs attention and jump-to-agent workflows.
      Native Home now filters loaded agents by name/session label and All/Working/Needs
      attention, preserving coverage, unavailable rows and identity/revision fences.
      Headless tests and physical light/dark checks are recorded in
      `evidence/home-filters-2026-10-11/`. Broader team/project/machine search, machine
      filters and remaining physical acceptance stay open. Home now supports `/`
      to focus search, `0` All, `w` Working, `a` toggle Attention, and Escape to
      clear/exit search. Modified keys, dialogs, search typing and marked IME
      retain their existing ownership; Workspace typing is not intercepted.
      Native physical qualification of these shortcuts is pending desktop unlock.
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
The existing multi-machine manager is now also shared through the Node-only
`@tmux-ide/daemon/machine-connections` subpath; the TUI retains its singleton and
telemetry adapter. The Home/multi-machine catalogs are also shared via the
Node-only `@tmux-ide/daemon/machine-catalog` subpath, retaining disabled stale rows
and per-machine identity scopes. The native `bridge/fleet.ts` adapter now projects
bounded, credential-free groups and issues exact-route selection tokens. Returned
selections retire on navigation, catalog failure or connection replacement.
Ordinary sessions without a workspace remain selectable for daemon promotion.
The agent observer, authenticated event transport and multi-machine aggregation
owner are now renderer-neutral under the daemon's Node-only `machine-agents`
subpath. TUI adapters retain selected-machine discovery and singleton defaults;
native callers must supply their manager. The default local GPUI browser now uses
that owner for foreground Home, with a globally bounded native roster and opaque
machine/session/agent keys. Opening validates fresh semantic/native ownership and
the captured route across asynchronous work. Private-host and Workspace rosters
retain their previous paths. See `evidence/native-fleet-agents-2026-10-11/`;
real cross-machine agent clicks and native physical acceptance remain open.
Local/remote discovery can resolve an explicitly selected server ID and generation;
private SSH host files now support that scope without reconnecting the transport.
The default local browser now owns the shared fleet manager and publishes groups
to native Home and the F5/F6 session picker. Selection uses the captured token and
the existing daemon promotion, pane catalog and input path. Private host-file
previews remain single-host and isolated. Machine filters, attention navigation,
real multi-machine SSH and release qualification remain open.

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
results cannot reconnect after navigation cancellation. Native F5 **Manage saved machines** now exposes revision-fenced enable/disable
actions through the existing canonical registry mutation path. The dialog uses
authoritative pending/results rather than optimistic saved-state changes. Keyboard
dispatch and stale/pending/unavailable guards have headless coverage. Physical
macOS enable/disable now has native screenshots and separate-process persisted
registry reads in `evidence/native-fleet-live-2026-10-11/`; restart restoration and
real SSH acceptance remain unqualified. Native edit/remove controls and physical
saved-picker/Add acceptance remain pending.
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

## Disconnected fleet retry

Native Home cards and F5 expose Retry for disconnected SSH machines via the shared
connection manager. Per-route tokens reject removed/replaced targets; retry does
not change saved settings or navigation. Queue failure stays visible in the
command picker. Physical native interaction and real SSH recovery are still open;
see `evidence/native-fleet-retry-2026-10-11/`.

## Disconnect a fleet machine

Native Home and F5 now expose Disconnect through the same manager operation used
by the TUI machine sidebar (`application-machine-navigation.ts`). This pauses that
SSH connection without disabling/removing its saved profile or stopping remote
sessions. A one-use capability binds the exact live handle and endpoint epoch;
replacement/removal retires it. A catalog failure does not necessarily close the
SSH transport, so Disconnect can remain available beside an unavailable catalog.
Selected route retirement reuses the existing input/child retirement path. Real
remote SSH/PTY acceptance remains a separate gate.


## Design direction — 11 October comparison

Keep TUI information architecture and daemon authority. Adopt consistent native
components rather than translating each TUI action into a separately styled row.
Zed's `crates/ui/src/components/button` and `tab.rs` show reusable control families,
explicit selected states and reserved icon/action slots. Herdr's existing
`sidebar/row.rs`, `tokens.rs` and `wash.rs` provide measured label budgets,
primary/secondary/muted typography and restrained machine-group color.

Next visual acceptance should prioritize:

- One compact titlebar/navigation band, aligned with native traffic lights.
- Machine/session sidebar hierarchy with aligned status/icon slots, measured long
  labels and quiet contextual actions; selection and keyboard focus stay distinct.
- Consistent window tabs and compact pane headers; terminal content gets priority.
- Home as a fleet overview with aligned agent/session rows and useful empty/error
  states, replacing oversized disconnected sections.
- A centered F5 command palette with search, groups, shortcut hints, keyboard
  selection and explicit disabled actions; coherent machine dialogs.
- Shared spacing, typography, icon sizes, control heights and semantic colors
  across all existing tmux-ide themes. Apply macOS material to surrounding chrome
  only after hierarchy/contrast is sound; keep terminal backgrounds legible.

Sources inspected: https://github.com/zed-industries/zed/tree/main/crates/ui/src/components,
https://zed.dev/docs/appearance, https://github.com/penso/herdr-gpui and the vendored
Herdr modules above. These are design targets, not completed visual parity claims.


## Next Home/F5 parity increments after the first popover

Independent source comparison identified these concrete gaps. None is complete
merely because an equivalent-looking button exists:

1. F6 session switching now uses the F5 popover family. F7 attention still needs
   the scoped observation and action lifetime described below.
2. F5 needs scoped machine/session/agent destinations and useful previews, beyond
   static commands and retry/disconnect (`application-shell-overlays.tsx`).
3. Home agent rows now have selected-row arrows, Page Up/Down, Home/End and
   Enter. Selection uses opaque keys and displayed roster revision; replaced rows
   cannot be opened before redraw. Physical nested-scroll/IME qualification
   remains distinct from headless controls.
4. Home needs machine filtering, observation Retry and Load more; connection retry
   is distinct. Reuse the shared observation owner rather than duplicating it.
5. Preserve machine/server/session hierarchy and qualify favorites/collapse, so
   duplicate session labels on different servers remain distinguishable
   (`application-machine-sidebar.tsx`).

Popover physical acceptance: normal/narrow Home and Workspace geometry; outside
click dismissal without underlying action/input; wheel isolation; marked IME and
paste ownership; Escape focus restoration without clearing interrupted-input
state; disabled/stale commands; light/dark contrast and resize while open.


### Fleet-wide F7 dependency

TUI F7 preserves the current view and filters enabled agent destinations by exact
`attention: true`. Native `homeAgents` is published only on foreground Home;
`workspaceAgents` covers the selected session. Neither is a global attention feed
for a popover over Workspace. Do not substitute a Home redirect, cached roster or
selected-session list for fleet-wide attention.

Add a bounded observation lifetime for the open F7 popover using the existing
fleet-agent owner. Admission must bind request, roster revision and opaque route
key, preserving fresh identity checks without weakening Home-only activation.
Retire on dismiss, background, navigation, connection retirement and shutdown.
Distinguish loading/unavailable/truncated from an empty attention result. Qualify
Home and Workspace, duplicate labels across machines, replaced routes, stale
revisions, dismissal/reopen, background during activation and no underlying
terminal input/resize. Existing Home Attention filtering also includes blocked
and failed states; F7 must use the TUI's exact attention predicate.

### F7 implementation qualification (11 October)

F7 now shares the native popover and fleet observation owner with Home. A scoped
subscription preserves Home/Workspace selection, input readiness and geometry.
Action admission checks foreground state, scope, roster revision, exact attention
flag and opaque live route; rejected actions retain the current terminal. Enter
submits navigation: once admitted, dismissing observation does not undo navigation.
Explicit newer navigation supersedes it with a higher request. Loading, partial,
unavailable and truncated coverage remain distinct from no observed attention.

Independent source review passed; the full bridge gate passed 333 tests with five
explicit skips, and an isolated real-daemon test verified workspace preservation
and correlated rejection for invalid scope/revision/key. Native workspace gates passed (2866 default / 2900 all-feature tests, both
Clippy configurations, formatting, size and debug build). Physical light-theme
Home and Workspace agent activation, paste isolation, outside dismissal and
unchanged pane dimensions passed. F7 narrow/dark/OS-IME and remote acceptance
remain open; this is not released parity. Unpromoted-session rows remain disabled
until ordinary session opening establishes native identity. Evidence:
`evidence/native-f7-attention-2026-10-11/`.
