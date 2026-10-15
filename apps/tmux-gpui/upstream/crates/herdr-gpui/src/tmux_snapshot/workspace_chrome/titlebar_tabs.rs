use super::*;

#[gpui::test]
fn application_tabs_share_titlebar_without_covering_drag_region(cx: &mut TestAppContext) {
    let (sender, receiver) = mpsc::sync_channel(64);
    let (_, cx) = cx.add_window_view(|window, cx| make_view(window, cx, sender));
    for width in [640., 1000.] {
        cx.simulate_resize(size(px(width), px(400.)));
        cx.update(|window, cx| window.draw(cx).clear(cx));
        let home = cx.debug_bounds("application-home").unwrap();
        let terminals = cx.debug_bounds("application-terminals").unwrap();
        let drag = cx.debug_bounds("application-drag-region").unwrap();
        let sidebar = cx.debug_bounds("sidebar-toggle").unwrap();
        let body = cx.debug_bounds("tmux-shell-body").unwrap();
        assert!(home.right() <= terminals.left());
        assert!(terminals.right() <= drag.left());
        assert!(drag.size.width >= px(100.));
        assert!(drag.right() <= sidebar.left());
        assert!(home.bottom() <= body.top());
        assert!(sidebar.right() <= px(width));
        if let Some(header) = cx.debug_bounds("titlebar") {
            assert_eq!(header.bottom(), body.top());
            assert!(home.top() >= header.top());
            assert!(home.left() >= px(if cfg!(target_os = "macos") { 80. } else { 8. }));
        }
    }
    assert!(receiver.try_iter().all(|command| matches!(
        command,
        browser::Command::Presence { .. }
            | browser::Command::Input {
                input: crate::tmux_snapshot::keys::Input::Resize { .. },
                ..
            }
    )));
}
