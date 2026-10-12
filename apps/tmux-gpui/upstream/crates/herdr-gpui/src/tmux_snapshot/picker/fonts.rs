//! Uses the existing searchable native picker, with no daemon commands.
use super::{Row, Target};
use crate::tmux_snapshot::terminal_font::{Choice, Settings};
pub(super) fn rows(settings: &Settings, query: &str) -> Vec<Row> {
    let query = query.to_lowercase();
    let mut rows = vec![
        Row {
            target: Target::Font(Choice::Size(1)),
            label: "Increase terminal size (+1 pt)".into(),
        },
        Row {
            target: Target::Font(Choice::Size(-1)),
            label: "Decrease terminal size (−1 pt)".into(),
        },
    ];
    rows.extend(settings.names.iter().map(|name| Row {
        target: Target::Font(Choice::Family(name.clone())),
        label: format!(
            "{}{}",
            if settings.config.family == *name {
                "✓ "
            } else {
                ""
            },
            name
        ),
    }));
    rows.into_iter()
        .filter(|r| {
            query
                .split_whitespace()
                .all(|q| r.label.to_lowercase().contains(q))
        })
        .take(256)
        .collect()
}
