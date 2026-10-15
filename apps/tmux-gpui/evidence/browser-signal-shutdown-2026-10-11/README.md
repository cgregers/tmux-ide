# Intentional browser helper shutdown

SIGTERM and SIGINT after the first startup publication produced exit 1 and
Native browser connection failed. A temporary diagnostic established the caught
error was ERR_STREAM_PREMATURE_CLOSE, caused by deliberate stdin destruction.

The helper now records explicit signal shutdown and suppresses only that exact
expected close error. Oversized input still reports failure and exits 1.
Temporary diagnostic logging was removed.

- before.log: both signal regressions failed, oversized input passed.
- mechanism.log: isolated error-code observation.
- after.log: all three final bounded process tests passed.
- staged-source.log: all three also passed against the staged browser source
  alone (without the separate uncommitted fleet integration).
- bridge.log: full working-tree bridge gate, 315 passed, 5 skipped. It includes
  pending fleet changes and predates the test harness deadline refinement; the
  final focused and staged-source checks cover that refinement.
- Focused ESLint passed. Independent reviewer approved the product patch and
  final fixture cleanup/deadlines. All tests use an isolated HOME/registry.

No existing demo or production daemon was restarted. This does not resolve or
qualify the separate native Home Loading sessions observation.
