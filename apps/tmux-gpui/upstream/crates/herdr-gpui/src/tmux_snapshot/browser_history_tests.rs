use super::*;
use serde_json::json;

fn history() -> anyhow::Result<serde_json::Value> {
    Ok(
        json!({"version":1,"connection":"history","sequence":1,"request":1,
        "surface":"workspace","inputReady":false,"historyOffset":30,
        "sessions":[{"id":"s","label":"Session"}],
        "panes":[{"id":"p","label":"Pane"}],
        "selectedSession":"s","selectedPane":"p","status":"History",
        "snapshot":serde_json::from_str::<serde_json::Value>(include_str!("../../../../../fixtures/snapshot.json"))?}),
    )
}

#[test]
fn history_is_bounded_read_only_and_bound_to_a_selected_frame() -> anyhow::Result<()> {
    let value = history()?;
    let state = Reader::default().accept(&serde_json::to_vec(&value)?)?;
    assert_eq!(state.history_offset, 30);
    assert!(!state.input_ready);
    for (field, invalid) in [
        ("historyOffset", json!(-1)),
        ("historyOffset", json!(1001)),
        ("historyOffset", json!(1.5)),
        ("historyOffset", json!("30")),
        ("snapshot", json!(null)),
        ("selectedPane", json!(null)),
        ("inputReady", json!(true)),
        ("surface", json!("home")),
    ] {
        let mut bad = value.clone();
        bad[field] = invalid;
        let mut reader = Reader::default();
        assert!(
            reader.accept(&serde_json::to_vec(&bad)?).is_err(),
            "{field}"
        );
        assert_eq!(
            reader.accept(&serde_json::to_vec(&value)?)?.history_offset,
            30
        );
    }
    Ok(())
}

#[test]
fn legacy_publication_defaults_to_live_and_new_live_frame_clears_history() -> anyhow::Result<()> {
    let mut value = history()?;
    let mut reader = Reader::default();
    reader.accept(&serde_json::to_vec(&value)?)?;
    value["sequence"] = json!(2);
    value["historyOffset"] = json!(0);
    value["inputReady"] = json!(true);
    assert_eq!(
        reader.accept(&serde_json::to_vec(&value)?)?.history_offset,
        0
    );
    value
        .as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("expected object"))?
        .remove("historyOffset");
    assert_eq!(
        Reader::default()
            .accept(&serde_json::to_vec(&value)?)?
            .history_offset,
        0
    );
    Ok(())
}
