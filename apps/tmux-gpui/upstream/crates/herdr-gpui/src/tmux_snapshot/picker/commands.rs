//! Initial TUI command vocabulary; actions stay with their existing owners.
use super::{Row, Target, browser};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(in crate::tmux_snapshot) enum Action {
    Home,
    AddMachine,
    LocalMachine,
    Sessions,
    Appearance,
    Refresh,
}
impl Action {
    pub(super) fn available(self, state: &browser::State) -> bool {
        self != Self::Appearance || state.appearance.is_some()
    }
}
pub(super) fn command_rows(state: &browser::State, query: &str) -> Vec<Row> {
    let query: String = query.chars().take(256).collect::<String>().to_lowercase();
    [
        (Action::Home, "Home"),
        (Action::AddMachine, "Connect to machine…"),
        (
            Action::LocalMachine,
            "Use local machine / cancel connection",
        ),
        (Action::Sessions, "Switch session"),
        (Action::Appearance, "Appearance…"),
        (Action::Refresh, "Refresh sessions"),
    ]
    .into_iter()
    .filter(|(action, label)| {
        action.available(state)
            && query
                .split_whitespace()
                .all(|term| label.to_lowercase().contains(term))
    })
    .map(|(action, label)| Row {
        target: Target::Command(action),
        label: label.into(),
    })
    .collect()
}
pub(in crate::tmux_snapshot) fn shortcut(key: &gpui::Keystroke) -> bool {
    key.key == "f5"
        && !key.modifiers.platform
        && !key.modifiers.control
        && !key.modifiers.alt
        && !key.modifiers.shift
}
