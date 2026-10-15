# Spark daemon recovery — 2026-10-11

User authorized updating/restarting the daemon while preserving tmux servers. Applied only the generated-code equivalent of reviewed source fix 90606cf5 to installed 2.9.5, guarded by exact original SHA256 and unique replacement assertions. No npm release or broad branch update.

Before SHA256: 51c800a577a84f2fc5b2bcfefdec26497d25e84cbf967d7d7c814b47ce920c79
After SHA256: eed201890e41b110585706bac442853e97aee3b5ab5f11a4f76ba547a945174d
Rollback copy: /home/thijs/.local/share/mise/installs/node/24.21.0/lib/node_modules/tmux-ide/bin/cli.before-spark-90606cf5.js

62 owner tests passed. Remote node syntax and isolated-HOME version smoke passed. The initial smoke resolved node through mise and downloaded Node into the temporary HOME; it did not change the production node installation.

Read-only independent rollout review required cgroup and exit-unattached checks. Effective service KillMode was control-group; its recursive group contained only the daemon and tmux clients. No stop hooks. tmux exit-unattached was off, and the sole server was in another scope. Immediately rechecked these guards before atomic file replacement and systemctl --user restart tmux-ide-daemon.service. Daemon PID changed from 963572 to 2003653.

All server PID/start-time identities, eight sessions and 59 pane identities matched exactly after restart. No kill-server, kill-session, or terminal commands were sent.

Same Spark cockpit diagnostic reached terminal snapshots and Keyboard ready with zero replica failed:true records. Concurrent diagnostic and GUI viewers produced transient Pane unavailable/input authority states; this is not a claim of flawless competing-viewer behavior. Diagnostic exited cleanly. Existing native preview was reopened through its Home cockpit entry and showed four rendered panes with Keyboard ready across subsequent inspections after the diagnostic ended. btop reported insufficient pane dimensions; other content rendered. No real terminal screenshots/content were saved to repository.

The preview is usable for continued testing; long-duration stability, input, resizing and other Spark sessions were not qualified in this increment. Installed version remains 2.9.5 with this local fix; future npm installation may overwrite it.
