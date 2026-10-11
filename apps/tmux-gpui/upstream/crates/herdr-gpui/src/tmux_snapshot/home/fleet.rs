use super::*;

impl SnapshotView {
    pub(in crate::tmux_snapshot) fn open_fleet_session(
        &mut self,
        request: u64,
        token: &str,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if self.browser_commands.is_none() || request != self.browser_request {
            return;
        }
        let Some(session) = self
            .browser_state
            .fleet
            .as_ref()
            .and_then(|f| f.session(token))
        else {
            return;
        };
        let Some(session_id) = session.session_id.clone() else {
            return;
        };
        self.select(
            Selection::FleetSession {
                selection: token.into(),
                session_id,
            },
            window,
            cx,
        );
    }
    pub(super) fn fleet_cards(&self, cx: &mut Context<Self>) -> Option<AnyElement> {
        let fleet = self.browser_state.fleet.as_ref()?;
        let theme = self.theme();
        let request = self.browser_request;
        let mut body = div().mt_4().flex().flex_col().gap_3();
        for (index, group) in fleet.groups.iter().enumerate() {
            let mut card = div()
                .min_w_0()
                .p_3()
                .rounded(px(crate::config::corners::PANEL))
                .border_1()
                .border_color(rgb(theme.active))
                .bg(rgb(theme.surface))
                .child(
                    div()
                        .flex()
                        .gap_2()
                        .child(
                            div()
                                .flex_1()
                                .truncate()
                                .font_weight(FontWeight::SEMIBOLD)
                                .child(crate::sidebar::label_text(&group.label)),
                        )
                        .child(div().text_color(rgb(theme.muted)).child(if group.conflict {
                            "Identity conflict"
                        } else {
                            group.state.label()
                        })),
                );
            if let Some(token) = group.retry.clone() {
                card = card.child(
                    div()
                        .id(("fleet-retry", index))
                        .mt_2()
                        .px_3()
                        .py_1()
                        .rounded(px(4.))
                        .bg(rgb(theme.active))
                        .cursor_pointer()
                        .child("Retry connection")
                        .on_click(cx.listener(move |view, _, window, cx| {
                            cx.stop_propagation();
                            view.retry_fleet_machine(request, &token, window, cx);
                        })),
                );
            }
            if group.sessions.is_empty() {
                card = card.child(
                    div()
                        .mt_2()
                        .text_color(rgb(theme.muted))
                        .child("No sessions available"),
                );
            }
            for (row, session) in group.sessions.iter().enumerate() {
                let token = session.selection.clone();
                let enabled = token.is_some() && self.browser_commands.is_some();
                card = card.child(
                    div()
                        .id(("fleet-session", index * 128 + row))
                        .mt_2()
                        .p_2()
                        .min_w_0()
                        .flex()
                        .gap_2()
                        .when(enabled, |d| {
                            d.cursor_pointer().hover(move |d| d.bg(rgb(theme.active)))
                        })
                        .child(
                            div()
                                .flex_1()
                                .truncate()
                                .child(crate::sidebar::label_text(&session.name)),
                        )
                        .child(div().text_color(rgb(theme.muted)).child(format!(
                            "{} panes · {}",
                            session.pane_count,
                            if enabled { "Open" } else { "Unavailable" }
                        )))
                        .on_click(cx.listener(move |view, _, window, cx| {
                            cx.stop_propagation();
                            if let Some(token) = &token {
                                view.open_fleet_session(request, token, window, cx);
                            }
                        })),
                );
            }
            if group.omitted_sessions > 0 {
                card = card.child(div().text_color(rgb(theme.muted)).child(format!(
                    "{} more sessions not shown",
                    group.omitted_sessions
                )));
            }
            body = body.child(card);
        }
        if fleet.omitted_groups > 0 {
            body = body.child(format!("{} more machines not shown", fleet.omitted_groups));
        }
        Some(body.into_any_element())
    }
}
