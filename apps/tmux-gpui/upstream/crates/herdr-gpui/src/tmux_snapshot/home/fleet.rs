use super::*;

impl SnapshotView {
    pub(in crate::tmux_snapshot) fn open_fleet_server(
        &mut self,
        request: u64,
        token: &str,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if self.browser_commands.is_none()
            || request != self.browser_request
            || !self.presence.ready()
            || self.browser_state.request != request
            || self
                .browser_state
                .fleet
                .as_ref()
                .is_none_or(|f| f.server(token).is_none())
        {
            return;
        }
        self.select(Selection::FleetServer(token.into()), window, cx);
    }

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
    fn fleet_session_row(
        &self,
        index: usize,
        row: usize,
        session: &browser::fleet::Session,
        cx: &mut Context<Self>,
    ) -> AnyElement {
        let theme = self.theme();
        let request = self.browser_request;
        let token = session.selection.clone();
        let enabled = token.is_some() && self.browser_commands.is_some();
        div()
            .id(("fleet-session", index * 128 + row))
            .debug_selector(move || format!("fleet-session-{index}-{row}"))
            .mt_2()
            .p_2()
            .min_w_0()
            .flex()
            .gap_2()
            .when(enabled, |d| {
                d.cursor_pointer().hover(move |d| d.bg(rgb(theme.active)))
            })
            .child(self.fleet_preference_button(
                ("fleet-favorite", index * 128 + row),
                session.favorite_action.as_deref(),
                !session.favorite,
                if session.favorite {
                    "Remove favorite"
                } else {
                    "Add favorite"
                },
                if session.favorite {
                    "icons/fleet-star-filled.svg"
                } else {
                    "icons/fleet-star.svg"
                },
                cx,
            ))
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
            }))
            .into_any_element()
    }
    pub(super) fn fleet_cards(&self, cx: &mut Context<Self>) -> Option<AnyElement> {
        let fleet = self.browser_state.fleet.as_ref()?;
        let theme = self.theme();
        let request = self.browser_request;
        let mut body = div().mt_4().flex().flex_col().gap_3();
        if let Some(status) = self.fleet_preference_status() {
            body = body.child(div().text_color(rgb(theme.muted)).child(status.to_owned()));
        }
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
                        .child(self.fleet_preference_button(
                            ("fleet-collapse", index),
                            group.collapse_action.as_deref(),
                            !group.collapsed,
                            if group.collapsed {
                                "Expand machine"
                            } else {
                                "Collapse machine"
                            },
                            if group.collapsed {
                                "icons/chevron-right.svg"
                            } else {
                                "icons/chevron-down.svg"
                            },
                            cx,
                        ))
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
            if let Some(token) = group.disconnect.clone() {
                card = card.child(
                    div()
                        .id(("fleet-disconnect", index))
                        .mt_2()
                        .px_3()
                        .py_1()
                        .rounded(px(4.))
                        .bg(rgb(theme.active))
                        .cursor_pointer()
                        .child("Disconnect")
                        .on_click(cx.listener(move |view, _, window, cx| {
                            cx.stop_propagation();
                            view.disconnect_fleet_machine(request, &token, window, cx);
                        })),
                );
            }
            if group.sessions.is_empty() && group.servers.is_empty() {
                card = card.child(
                    div()
                        .mt_2()
                        .text_color(rgb(theme.muted))
                        .child("No sessions available"),
                );
            }
            for (server_index, server) in group.servers.iter().enumerate() {
                if group.collapsed
                    && !group
                        .sessions
                        .iter()
                        .any(|s| s.server_id.as_ref() == Some(&server.id) && group.shows(s))
                {
                    continue;
                }
                let token = server.selection.clone();
                let enabled = token.is_some() && self.browser_commands.is_some();
                let selected =
                    self.browser_state
                        .selected_server
                        .as_ref()
                        .is_some_and(|selected| {
                            selected.machine_id == group.id
                                && selected.server_id == server.id
                                && server.generation.as_ref() == Some(&selected.generation)
                        });
                let mut section = div().ml_3().mt_2().min_w_0().flex().flex_col().child(
                    div()
                        .id(("fleet-server", index * 32 + server_index))
                        .debug_selector(move || format!("fleet-server-{index}-{server_index}"))
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
                                .child(crate::sidebar::label_text(&server.label)),
                        )
                        .child(div().text_color(rgb(theme.muted)).child(if selected {
                            "Selected"
                        } else if enabled {
                            "Select server"
                        } else {
                            "Unavailable"
                        }))
                        .on_click(cx.listener(move |view, _, window, cx| {
                            cx.stop_propagation();
                            if let Some(token) = &token {
                                view.open_fleet_server(request, token, window, cx);
                            }
                        })),
                );
                let mut count = 0;
                for (row, session) in group
                    .sessions
                    .iter()
                    .enumerate()
                    .filter(|(_, s)| s.server_id.as_ref() == Some(&server.id) && group.shows(s))
                {
                    count += 1;
                    section = section.child(self.fleet_session_row(index, row, session, cx));
                }
                if count == 0 {
                    section = section.child(
                        div()
                            .ml_3()
                            .text_color(rgb(theme.muted))
                            .child("No sessions"),
                    );
                }
                card = card.child(section);
            }
            for (row, session) in group.sessions.iter().enumerate().filter(|(_, s)| {
                group.shows(s)
                    && s.server_id
                        .as_ref()
                        .is_none_or(|id| !group.servers.iter().any(|server| &server.id == id))
            }) {
                card = card.child(self.fleet_session_row(index, row, session, cx));
            }
            if group.omitted_servers > 0 {
                card = card.child(
                    div()
                        .text_color(rgb(theme.muted))
                        .child(format!("{} more servers not shown", group.omitted_servers)),
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
