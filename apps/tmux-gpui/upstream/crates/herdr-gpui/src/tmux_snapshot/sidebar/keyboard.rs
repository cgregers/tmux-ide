//! Exact displayed-session keyboard focus; terminal authority remains independent.
use super::*;
use crate::tmux_snapshot::SnapshotView;

#[derive(Default)]
pub(in crate::tmux_snapshot) struct Keyboard {
    pub(in crate::tmux_snapshot) active: bool,
    pub(in crate::tmux_snapshot::browser_ui) focus: Option<FocusHandle>,
    pub(in crate::tmux_snapshot::browser_ui) selected: Option<String>,
    pub(in crate::tmux_snapshot::browser_ui) scroll: ScrollHandle,
    request: u64,
    displayed: Vec<String>,
}
pub(in crate::tmux_snapshot::browser_ui) fn focus_shortcut(key: &Keystroke) -> bool {
    key.key == "g"
        && key.modifiers.control
        && !key.modifiers.platform
        && !key.modifiers.alt
        && !key.modifiers.shift
}
impl SnapshotView {
    fn sidebar_keyboard_allowed(&self) -> bool {
        self.browser_state.surface == browser::Surface::Workspace
            && !self.sidebar_hidden
            && self.browser_commands.is_some()
            && self.browser_state.request == self.browser_request
            && self.presence.ready()
            && self.picker.is_none()
            && self.pane_actions.is_none()
            && self.new_session.is_none()
            && self.marked.is_empty()
            && self.divider.is_none()
    }
    pub(in crate::tmux_snapshot::browser_ui) fn reconcile_sidebar_keyboard(
        &mut self,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let valid = self.sidebar_keyboard_allowed()
            && self.sidebar_keyboard.request == self.browser_request;
        if !valid && self.sidebar_keyboard.active {
            self.sidebar_keyboard.active = false;
            self.interrupt_input(cx);
        }
        let state = &mut self.sidebar_keyboard;
        if !state.active {
            if state.focus.as_ref().is_some_and(|f| f.is_focused(window)) {
                self.terminal_focus.focus(window, cx);
            }
            return;
        }
        let old = state
            .displayed
            .iter()
            .position(|id| Some(id) == state.selected.as_ref());
        state.displayed = self
            .browser_state
            .sessions
            .iter()
            .map(|s| s.id.clone())
            .collect();
        let next = state
            .displayed
            .iter()
            .position(|id| Some(id) == state.selected.as_ref());
        if next.is_none() {
            state.selected = None;
        }
        if next != old
            && let Some(index) = next
        {
            state.scroll.scroll_to_item(index + 1);
        }
    }
    pub(in crate::tmux_snapshot) fn sidebar_keyboard_key(
        &mut self,
        event: &KeyDownEvent,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> bool {
        let key = &event.keystroke;
        if focus_shortcut(key) {
            if !event.is_held
                && self.marked.is_empty()
                && self.picker.is_none()
                && self.pane_actions.is_none()
                && self.new_session.is_none()
                && self.presence.ready()
                && self.browser_commands.is_some()
            {
                if self.sidebar_keyboard_allowed() {
                    let state = &mut self.sidebar_keyboard;
                    state
                        .focus
                        .get_or_insert_with(|| cx.focus_handle())
                        .focus(window, cx);
                    state.active = true;
                    state.request = self.browser_request;
                    state.displayed = self
                        .browser_state
                        .sessions
                        .iter()
                        .map(|s| s.id.clone())
                        .collect();
                    state.selected = self
                        .browser_state
                        .selected_session
                        .clone()
                        .filter(|id| state.displayed.contains(id));
                    if let Some(index) = state
                        .displayed
                        .iter()
                        .position(|id| Some(id) == state.selected.as_ref())
                    {
                        state.scroll.scroll_to_item(index + 1);
                    }
                    cx.notify();
                } else if self.browser_state.surface == browser::Surface::Home
                    || self.sidebar_hidden
                {
                    self.open_picker(window, cx);
                }
            }
            cx.stop_propagation();
            window.prevent_default();
            return true;
        }
        if !self.sidebar_keyboard.active
            || !self
                .sidebar_keyboard
                .focus
                .as_ref()
                .is_some_and(|f| f.is_focused(window))
        {
            return false;
        }
        if key.modifiers.platform || super::super::super::picker::commands::shortcut(key) {
            return false;
        }
        cx.stop_propagation();
        window.prevent_default();
        if !self.sidebar_keyboard_allowed() || self.sidebar_keyboard.request != self.browser_request
        {
            self.sidebar_keyboard.active = false;
            self.interrupt_input(cx);
            self.terminal_focus.focus(window, cx);
            cx.notify();
            return true;
        }
        if key.modifiers.control
            || key.modifiers.platform
            || key.modifiers.alt
            || key.modifiers.shift
        {
            return true;
        }
        if key.key == "escape" {
            self.sidebar_keyboard.active = false;
            self.terminal_focus.focus(window, cx);
            cx.notify();
            return true;
        }
        let state = &mut self.sidebar_keyboard;
        if state
            .selected
            .as_ref()
            .is_some_and(|id| !self.browser_state.sessions.iter().any(|s| &s.id == id))
        {
            state.selected = None;
        }
        if matches!(key.key.as_str(), "enter" | "return") {
            if event.is_held {
                return true;
            }
            if let Some(id) = state
                .selected
                .clone()
                .filter(|id| state.displayed.contains(id))
            {
                let request = state.request;
                self.select_sidebar(request, &Target::Session(id), window, cx);
            }
            return true;
        }
        // Only rows already painted may receive keyboard focus; a refresh cannot invent a replacement.
        let rows: Vec<_> = state
            .displayed
            .iter()
            .filter(|id| self.browser_state.sessions.iter().any(|s| &s.id == *id))
            .cloned()
            .collect();
        if rows.is_empty() {
            return true;
        }
        let current = rows
            .iter()
            .position(|id| Some(id) == state.selected.as_ref());
        let page = state
            .scroll
            .bottom_item()
            .saturating_sub(state.scroll.top_item())
            .max(1);
        let index = match key.key.as_str() {
            "up" => current.unwrap_or(0).saturating_sub(1),
            "down" => current.map_or(0, |index| (index + 1).min(rows.len() - 1)),
            "pageup" => current.unwrap_or(0).saturating_sub(page),
            "pagedown" => current.map_or(0, |index| (index + page).min(rows.len() - 1)),
            "home" => 0,
            "end" => rows.len() - 1,
            _ => return true,
        };
        state.selected = Some(rows[index].clone());
        if let Some(index) = state
            .displayed
            .iter()
            .position(|id| Some(id) == state.selected.as_ref())
        {
            state.scroll.scroll_to_item(index + 1);
        }
        cx.notify();
        true
    }
}
