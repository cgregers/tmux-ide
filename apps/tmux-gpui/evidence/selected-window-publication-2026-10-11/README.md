# Selected-window publication overflow

User reported panes load then disappear even after Spark daemon startup FIFO repair. The earlier recovery claim was premature: initial rendering did not prove sustained connection.

Real Spark prototyper-mgt reproduced Keyboard ready followed by Pane unavailable about 250 ms later. Diagnostic metadata proved live.ts output threw at the 8 MiB guard: 11,168,488 bytes from selected snapshot plus three full-window surfaces (291x90, 291x90, 291x91). No scrollback was present. A second non-instrumented 60-second baseline reproduced loss.

Only surfaces for the uniquely identified selected pane's window are now serialized. Full replica state and layout catalog remain resident; visible sibling panes remain included. All authority, ACK, history and 8 MiB checks remain unchanged. Independent review approved the frozen three files.

The same session with rebuilt bridge held its snapshot for 57.2 seconds after loading during a 60-second run, with zero subsequent snapshot losses; baseline recorded repeated unavailable publications. Probe ends by explicitly terminating its own helper. This establishes the reproduced immediate failure is repaired, not long-duration or universal terminal parity. Oversized selected windows alone may still exceed the guard.

Full bridge gate:397 passed,5 optional skips. Two focused regressions and TypeScript/lint passed. Replacement unsigned local app: /private/tmp/Tmux IDE Window Fix.app, same release native binary plus corrected bridge. Spark daemon/server not restarted in this increment. No real terminal content captured in repository evidence.
