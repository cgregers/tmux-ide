use super::{Action, Mode, Row, SnapshotView, Target, browser};
use gpui::{prelude::*, *};

pub(super) fn rows(state: &browser::State, query: &str) -> Vec<Row> {
    let query = query.chars().take(256).collect::<String>().to_lowercase();
    let mut rows = vec![
        Row {
            target: Target::Command(Action::LocalMachine),
            label: "Local machine".into(),
        },
        Row {
            target: Target::Command(Action::AddMachine),
            label: "Connect to another machine…".into(),
        },
    ];
    if let Some(registry) = &state.machines {
        rows.extend(registry.machines.iter().map(|profile| Row {
            target: Target::Machine {
                id: profile.id.clone(),
                revision: registry.revision,
            },
            label: format!(
                "{} · {}{}",
                profile.label,
                profile.ssh_target,
                if !registry.available {
                    " · unavailable"
                } else if !profile.enabled {
                    " · disabled"
                } else {
                    ""
                }
            ),
        }));
    }
    rows.retain(|row| {
        query
            .split_whitespace()
            .all(|term| row.label.to_lowercase().contains(term))
    });
    rows
}

impl SnapshotView {
    pub(super) fn open_saved_machines(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.open_picker_mode(Mode::SavedMachines, window, cx);
        if let Some(sender) = &self.browser_commands
            && sender
                .try_send(browser::Command::Machines {
                    request: self.browser_request,
                    operation: browser::machines::Operation::Read,
                })
                .is_err()
            && let Some(picker) = &mut self.picker
        {
            picker.error = Some("Machine list unavailable — close and try again");
        }
        cx.notify();
    }

    pub(super) fn saved_machines_dialog(&self, cx: &mut Context<Self>) -> AnyElement {
        let theme = self.theme();
        let message = match &self.browser_state.machines {
            None => "Loading saved machines…".to_owned(),
            Some(registry) => registry
                .message
                .as_ref()
                .or(registry.error.as_ref())
                .cloned()
                .unwrap_or_else(|| {
                    if registry.machines.is_empty() {
                        "No saved machines yet. Connect to an SSH machine to get started.".into()
                    } else {
                        "Choose a saved machine or return to Local.".into()
                    }
                }),
        };
        div()
            .id("saved-machines-overlay")
            .absolute()
            .inset_0()
            .size_full()
            .flex()
            .items_center()
            .justify_center()
            .bg(rgba(0x00000088))
            .on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
            .child(
                div()
                    .id("saved-machines-dialog")
                    .w(px(520.))
                    .max_w_full()
                    .h(px(420.))
                    .max_h_full()
                    .p_4()
                    .rounded(px(8.))
                    .bg(rgb(theme.surface))
                    .border_1()
                    .border_color(rgb(theme.active))
                    .flex()
                    .flex_col()
                    .gap_2()
                    .overflow_hidden()
                    .child(
                        div()
                            .text_lg()
                            .font_weight(FontWeight::SEMIBOLD)
                            .child("Machines"),
                    )
                    .child(div().text_color(rgb(theme.muted)).child(message))
                    .child(self.picker_render(cx))
                    .child(
                        div().flex().justify_end().child(
                            div()
                                .id("saved-machines-cancel")
                                .px_3()
                                .py_2()
                                .cursor_pointer()
                                .child("Cancel")
                                .on_click(
                                    cx.listener(|view, _, window, cx| {
                                        view.close_picker(window, cx)
                                    }),
                                ),
                        ),
                    ),
            )
            .into_any_element()
    }
}
