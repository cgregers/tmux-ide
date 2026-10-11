//! Bounded local-registry publication; connection and mutation authority stays in the bridge.
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(super) struct Registry {
    revision: u64,
    #[serde(rename = "available")]
    _available: bool,
    #[serde(rename = "pending")]
    _pending: bool,
    error: Option<String>,
    message: Option<String>,
    machines: Vec<Profile>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Profile {
    id: String,
    label: String,
    ssh_target: String,
    expected_environment_id: Option<String>,
    #[serde(rename = "enabled")]
    _enabled: bool,
}
fn uuid(value: &str) -> bool {
    value.len() == 36 && uuid::Uuid::parse_str(value).is_ok()
}
fn text(value: &str, maximum: usize) -> bool {
    !value.is_empty() && value.chars().count() <= maximum && !value.chars().any(char::is_control)
}
impl Registry {
    pub(super) fn valid(&self) -> bool {
        let mut ids = HashSet::new();
        // available/pending describe independent read and mutation state. In particular,
        // a filesystem failure can make the registry unavailable while a write is pending.
        self.revision <= 9_007_199_254_740_991
            && self.machines.len() <= 64
            && [&self.error, &self.message]
                .into_iter()
                .all(|value| value.as_ref().is_none_or(|value| text(value, 256)))
            && self.machines.iter().all(|profile| {
                uuid(&profile.id)
                    && ids.insert(profile.id.to_lowercase())
                    && text(&profile.label, 80)
                    && text(&profile.ssh_target, 255)
                    && profile
                        .expected_environment_id
                        .as_ref()
                        .is_none_or(|value| uuid(value))
            })
    }
}
