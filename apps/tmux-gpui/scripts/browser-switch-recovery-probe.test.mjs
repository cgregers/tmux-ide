import test from "node:test";
import assert from "node:assert/strict";
import { createPhaseOracle, parseOptions } from "./browser-switch-recovery-probe.mjs";
import { diagnosticStatus } from "../bridge/live-diagnostics.ts";
const ready = {
  connection: "browser",
  sequence: 1,
  request: 2,
  selectedSession: "session",
  selectedPane: "pane",
  surface: "workspace",
  snapshot: {},
  inputReady: true,
  presenceRevision: 1,
};
test("isolated probe refuses real-host and requires explicit bounded intervals", () => {
  const args = ["--app", "/app", "--cli", "/cli", "--cycles", "2", "--hold-seconds", "1"];
  assert.equal(parseOptions(args).cycles, 2);
  assert.throws(() => parseOptions([...args, "--real-host"]));
  assert.throws(() => parseOptions(args.slice(0, 6)));
  assert.throws(() => parseOptions([...args.slice(0, 5), "99", ...args.slice(6)]));
});
test("steady readiness loss fails after initial success; explicit next selection resets phase", () => {
  const oracle = createPhaseOracle();
  oracle.pane(2, "session", "pane");
  oracle.observe(ready);
  assert.equal(oracle.ready(), true);
  assert.throws(
    () => oracle.observe({ ...ready, sequence: 2, snapshot: null }),
    /steady-readiness-lost/,
  );
  const next = createPhaseOracle();
  next.pane(2, "session", "pane");
  next.observe(ready);
  next.pane(3, "session", "other");
  next.observe({ ...ready, sequence: 2, request: 3, snapshot: null, inputReady: false });
  assert.equal(next.ready(), false);
  next.observe({ ...ready, sequence: 3, request: 3, selectedPane: "other" });
  assert.equal(next.ready(), true);
});
test("disconnect requires newer cleared authority and exact closed diagnostic, then cannot rearm", () => {
  const oracle = createPhaseOracle();
  oracle.observe(ready);
  oracle.disconnected();
  oracle.observe({ ...ready, sequence: 2, snapshot: null, inputReady: false, status: "Loading" });
  assert.equal(oracle.isDisconnected(), false);
  oracle.observe({
    ...ready,
    sequence: 3,
    snapshot: null,
    inputReady: false,
    status: diagnosticStatus({ code: "transport-closed", closeCode: 1001 }),
  });
  assert.equal(oracle.isDisconnected(), true);
  assert.throws(() => oracle.observe({ ...ready, sequence: 4 }), /disconnected-authority-returned/);
});
test("wrong pane cannot qualify and recovery cannot replace browser connection", () => {
  const oracle = createPhaseOracle();
  oracle.pane(2, "session", "other");
  oracle.observe(ready);
  assert.equal(oracle.ready(), false);
  oracle.transition();
  assert.throws(
    () => oracle.observe({ ...ready, sequence: 2, connection: "replacement" }),
    /browser-connection-replaced/,
  );
});
test("only controlled disconnect may emit its exact safe diagnostic", () => {
  const oracle = createPhaseOracle();
  const line = 'TMUX_GPUI_DIAGNOSTIC {"code":"transport-closed","closeCode":1001}';
  assert.throws(() => oracle.diagnostic(line), /unexpected-diagnostic/);
  oracle.observe(ready);
  oracle.disconnected();
  oracle.diagnostic(line);
  assert.throws(
    () => oracle.diagnostic('TMUX_GPUI_DIAGNOSTIC {"code":"replica-validation"}'),
    /unexpected-diagnostic/,
  );
  assert.throws(() => oracle.diagnostic("unstructured private error"), /unexpected-diagnostic/);
});
