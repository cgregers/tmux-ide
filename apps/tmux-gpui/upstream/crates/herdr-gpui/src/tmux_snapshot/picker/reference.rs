//! Native-supported reference only. TUI application-shortcuts.ts supplies the
//! category pattern; unsupported TUI-only terminal/session keys are not advertised.
use super::{Action, Row, Target};
const SHORTCUTS: &[&str] = &[
    "Application · F1 — Home",
    "Application · F2 — Terminals",
    "Application · F5 — Commands",
    "Application · Cmd+K — Search sessions and panes",
    "Application · F6 — Search sessions and panes",
    "Application · F7 — Needs attention (when available)",
    "Workspace · F10 — Show or hide sidebar",
    "Home · / — Focus agent search",
    "Home · 0 — All agents",
    "Home · w — Working agents",
    "Home · a — Toggle Needs attention",
    "Home · f — Cycle machine filter (when available)",
    "Home · r — Retry observations (when available)",
    "Home · m — Load more sessions (when available)",
    "Terminal selection · Cmd+C — Copy selected text",
    "Terminal · Cmd+Shift+C — Copy visible pane (no selection)",
    "Terminal · Cmd+V — Paste (live input authority required)",
    "Terminal · Shift+PageUp / PageDown — Scroll history",
    "Terminal · Shift+End — Return to live",
    "Menus · Type — Search",
    "Menus · ↑ / ↓ — Move selection",
    "Menus · Enter — Activate selected available action",
    "Menus · Esc — Dismiss; reference returns to Commands",
    "Text fields · Composition owns Enter and Escape",
];
pub(super) fn rows(query: &str) -> Vec<Row> {
    let query = query.to_lowercase();
    SHORTCUTS
        .iter()
        .filter(|label| {
            query
                .split_whitespace()
                .all(|term| label.to_lowercase().contains(term))
        })
        .map(|label| Row {
            target: Target::Command(Action::Shortcuts),
            label: (*label).into(),
        })
        .collect()
}
