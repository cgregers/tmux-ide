# Local alpha handoff — 2026-10-12

Installed and launched `/Users/thijs/Applications/Tmux IDE Alpha.app`, copied from the qualified Fleet Retirement package. Only bundle display name and identifier changed. Source checkpoint c23215aa; the uncommitted shortcuts-reference feature is excluded.

Native clipboard -> GPUI -> daemon -> isolated raw PTY passed: exact 42 bytes, Unicode, combining mark, emoji, newline and bracketed-paste framing. Cmd-Q preserved the producer; fixture cleanup passed. See receipt.json and paste.log.

An earlier attempt captured unsolicited ASCII `s` before the operator pasted; that attempt is inconclusive and remains at `/private/tmp/gpui-native-paste-unlocked-20261012`. Do not count it as a paste pass or confirmed product defect.

The installed alpha opened Home and discovered the local two-pane session; Spark was still connecting at initial observation. Public release, signing, fresh hosted CI and remaining physical scroll/copy/resize qualification are not claimed complete. Production tmux servers were not stopped.
