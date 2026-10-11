//! Presentation-only filters over the bounded published agent roster.
use super::*;
use crate::search_input::{Changed, SearchInput};
use browser::home_agents::{Phase, Roster, Row, Status};

#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub(in crate::tmux_snapshot) enum Filter {
    #[default]
    All,
    Working,
    Attention,
}
impl Filter {
    fn label(self) -> &'static str {
        match self {
            Self::All => "All",
            Self::Working => "Working",
            Self::Attention => "Needs attention",
        }
    }
    pub(super) fn matches(self, roster: &Roster, row: &Row, query: &str) -> bool {
        let query = query.trim().to_lowercase();
        (row.name.to_lowercase().contains(&query)
            || row.session_label.to_lowercase().contains(&query))
            && match self {
                Self::All => true,
                Self::Working => {
                    matches!(roster.phase, Phase::Live | Phase::Partial)
                        && row.available
                        && matches!(row.status, Status::Working)
                }
                Self::Attention => {
                    row.attention || matches!(row.status, Status::Blocked | Status::Failed)
                }
            }
    }
}
pub(in crate::tmux_snapshot) struct Controls {
    pub(super) search: Entity<SearchInput>,
    pub(super) filter: Filter,
    _changed: Subscription,
    theme: crate::config::Theme,
}
impl SnapshotView {
    pub(super) fn prepare_home_filter(&mut self, cx: &mut Context<Self>) {
        let theme = self.theme();
        if self.home_filter.is_none() {
            let search = cx.new(|cx| {
                let mut input = SearchInput::new(cx).with_max_bytes(1024);
                input.set_placeholder("Search loaded agents…", cx);
                input.set_appearance(crate::config::Config::default().ui, theme.clone(), cx);
                input
            });
            let changed = cx.subscribe(&search, |_, _, _: &Changed, cx| cx.notify());
            self.home_filter = Some(Controls {
                search,
                filter: Filter::All,
                _changed: changed,
                theme: theme.clone(),
            });
        }
        if let Some(controls) = &mut self.home_filter
            && controls.theme != theme
        {
            controls.theme = theme.clone();
            controls.search.update(cx, |input, cx| {
                input.set_appearance(crate::config::Config::default().ui, theme, cx)
            });
        }
    }
    pub(in crate::tmux_snapshot) fn home_search_composing(
        &self,
        window: &Window,
        cx: &Context<Self>,
    ) -> bool {
        self.browser_state.surface == browser::Surface::Home
            && self.home_filter.as_ref().is_some_and(|c| {
                let input = c.search.read(cx);
                input.focus.is_focused(window) && input.is_composing()
            })
    }
    pub(super) fn home_filter_controls(&self, cx: &mut Context<Self>) -> AnyElement {
        let Some(controls) = &self.home_filter else {
            return div().into_any_element();
        };
        let theme = self.theme();
        let mut tabs = div().flex().flex_wrap().gap_2();
        for filter in [Filter::All, Filter::Working, Filter::Attention] {
            tabs = tabs.child(
                div()
                    .id(filter.label())
                    .debug_selector(move || format!("home-filter-{}", filter.label()))
                    .px_3()
                    .py_1()
                    .rounded(px(4.))
                    .cursor_pointer()
                    .bg(rgb(if controls.filter == filter {
                        theme.active
                    } else {
                        theme.surface
                    }))
                    .child(filter.label())
                    .on_click(cx.listener(move |view, _, _, cx| {
                        if view.browser_state.surface == browser::Surface::Home
                            && let Some(controls) = &mut view.home_filter
                        {
                            controls.filter = filter;
                            cx.notify();
                        }
                    })),
            );
        }
        div()
            .w_full()
            .min_w_0()
            .flex()
            .flex_col()
            .gap_2()
            .child(controls.search.clone())
            .child(tabs)
            .into_any_element()
    }
}
