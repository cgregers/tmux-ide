//! F5 projects the existing pane-action capability without adding a transport verb.
use super::{Row, Target, browser};
use crate::tmux_snapshot::pane_actions;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(in crate::tmux_snapshot) enum Action {
    NewWindow,
    Zoom(bool),
    SplitRight,
    SplitDown,
}
impl Action {
    pub(super) fn wire(self) -> pane_actions::Action {
        match self {
            Self::NewWindow => pane_actions::Action::NewWindow,
            Self::Zoom(true) => pane_actions::Action::Zoom {
                desired: pane_actions::Zoom::Zoomed,
            },
            Self::Zoom(false) => pane_actions::Action::Zoom {
                desired: pane_actions::Zoom::Unzoomed,
            },
            Self::SplitRight => pane_actions::Action::Split {
                direction: pane_actions::SplitDirection::Right,
            },
            Self::SplitDown => pane_actions::Action::Split {
                direction: pane_actions::SplitDirection::Down,
            },
        }
    }
}
pub(super) fn rows(state: &browser::State, query: &str) -> Vec<Row> {
    if state.surface != browser::Surface::Workspace {
        return Vec::new();
    }
    let captured = pane_actions::Target::capture(state);
    let zoomed = state
        .pane_actions
        .as_ref()
        .is_some_and(|actions| actions.zoomed);
    [
        (Action::NewWindow, "New terminal window"),
        (
            Action::Zoom(!zoomed),
            if zoomed { "Unzoom pane" } else { "Zoom pane" },
        ),
        (Action::SplitRight, "Split right"),
        (Action::SplitDown, "Split down"),
    ]
    .into_iter()
    .filter(|(_, label)| {
        query
            .split_whitespace()
            .all(|term| label.to_lowercase().contains(term))
    })
    .map(|(action, label)| Row {
        target: Target::PaneAction {
            captured: captured.clone(),
            action,
        },
        label: label.into(),
    })
    .collect()
}
