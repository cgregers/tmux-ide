//! Display-only fleet metadata. Opaque selection authority belongs to the bridge.
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(in crate::tmux_snapshot) struct Fleet {
    pub groups: Vec<Group>,
    pub omitted_groups: u64,
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(in crate::tmux_snapshot) struct Group {
    pub id: String,
    pub label: String,
    pub state: Phase,
    pub conflict: bool,
    pub omitted_sessions: u64,
    pub sessions: Vec<Session>,
}
#[derive(Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(in crate::tmux_snapshot) enum Phase {
    Ready,
    Connecting,
    Disconnected,
}
impl Phase {
    pub fn label(self) -> &'static str {
        match self {
            Self::Ready => "Connected",
            Self::Connecting => "Connecting…",
            Self::Disconnected => "Disconnected",
        }
    }
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(in crate::tmux_snapshot) struct Session {
    pub id: String,
    pub name: String,
    pub pane_count: u64,
    pub session_id: Option<String>,
    pub selection: Option<String>,
}
fn text(value: &str, limit: usize) -> bool {
    !value.is_empty() && value.chars().count() <= limit
}
impl Fleet {
    pub(super) fn valid(&self) -> bool {
        let mut groups = HashSet::new();
        let mut tokens = HashSet::new();
        self.groups.len() <= 64
            && self.omitted_groups <= 9_007_199_254_740_991
            && self.groups.iter().map(|g| g.sessions.len()).sum::<usize>() <= 512
            && self.groups.iter().all(|g| {
                let mut ids = HashSet::new();
                text(&g.id, 256)
                    && groups.insert(&g.id)
                    && text(&g.label, 256)
                    && g.sessions.len() <= 128
                    && g.omitted_sessions <= 9_007_199_254_740_991
                    && g.sessions.iter().all(|s| {
                        text(&s.id, 4096)
                            && ids.insert(&s.id)
                            && text(&s.name, 512)
                            && s.pane_count <= 9_007_199_254_740_991
                            && s.session_id.as_ref().is_none_or(|id| text(id, 512))
                            && s.selection.as_ref().is_none_or(|token| {
                                g.state == Phase::Ready
                                    && !g.conflict
                                    && s.session_id.is_some()
                                    && token.len() == 36
                                    && uuid::Uuid::parse_str(token).is_ok()
                                    && tokens.insert(token)
                            })
                    })
            })
    }
    pub fn session(&self, token: &str) -> Option<&Session> {
        self.groups
            .iter()
            .filter(|g| g.state == Phase::Ready && !g.conflict)
            .flat_map(|g| &g.sessions)
            .find(|s| s.selection.as_deref() == Some(token))
    }
}
