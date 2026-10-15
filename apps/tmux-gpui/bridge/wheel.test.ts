import { test } from "node:test";
import assert from "node:assert/strict";
import { blankTerminalReplicaSnapshot } from "../../../packages/core/src/terminal-replica.ts";
import { routeWheel } from "./wheel.ts";
const snapshot = blankTerminalReplicaSnapshot(80, 24);
const wheel = {
  kind: "wheel",
  data: { lines: 2, row: 3, col: 4, shift: false, alt: false, control: false },
};
test("mouse-reporting alternate-screen application receives wheel instead of empty local history", () => {
  const app = {
    ...snapshot,
    modes: {
      ...snapshot.modes,
      alternateScreen: true,
      mouseEncoding: "sgr" as const,
      mouseProtocol: "any" as const,
    },
  };
  assert.deepEqual(routeWheel(app, 0, wheel), {
    kind: "application",
    inputs: [{ kind: "text", data: "\x1b[<64;5;4M".repeat(2) }],
  });
});
test("Shift, retained history, and non-reporting screens remain local without arrow fallback", () => {
  const app = {
    ...snapshot,
    modes: {
      ...snapshot.modes,
      alternateScreen: true,
      mouseEncoding: "sgr" as const,
      mouseProtocol: "any" as const,
    },
  };
  for (const [state, offset, event] of [
    [snapshot, 0, wheel],
    [app, 1, wheel],
    [app, 0, { ...wheel, data: { ...wheel.data, shift: true } }],
    [{ ...app, modes: { ...app.modes, mouseProtocol: "x10" as const } }, 0, wheel],
  ] as const)
    assert.deepEqual(routeWheel(state, offset, event), { kind: "history", lines: 2 });
});
test("canonical encodings retain Ctrl, strip Alt, and reject out-of-pane coordinates", () => {
  const app = {
    ...snapshot,
    modes: { ...snapshot.modes, mouseEncoding: "sgr" as const, mouseProtocol: "vt200" as const },
  };
  const down = { ...wheel, data: { ...wheel.data, lines: -3, control: true, alt: true } };
  assert.deepEqual(routeWheel(app, 0, down), {
    kind: "application",
    inputs: [{ kind: "text", data: "\x1b[<81;5;4M".repeat(3) }],
  });
  assert.deepEqual(
    routeWheel({ ...app, modes: { ...app.modes, mouseEncoding: "default" } }, 0, wheel),
    { kind: "application", inputs: [{ kind: "bytes", data: "1b5b4d602524".repeat(2) }] },
  );
  assert.equal(routeWheel(app, 0, { ...wheel, data: { ...wheel.data, col: 80 } }), null);
  assert.equal(routeWheel(app, 0, { ...wheel, data: { ...wheel.data, row: 24 } }), null);
  for (const data of [
    { ...wheel.data, lines: 129 },
    { ...wheel.data, lines: 0 },
    { ...wheel.data, row: -1 },
    { ...wheel.data, col: 1.5 },
    { ...wheel.data, extra: true },
  ])
    assert.throws(() => routeWheel(app, 0, { ...wheel, data }));
});
test("maximum positive and negative wheel counts preserve whole reports in bounded batches", () => {
  for (const encoding of ["sgr", "utf8", "default"] as const) {
    const app = {
      ...snapshot,
      cols: 16000,
      rows: 16000,
      modes: { ...snapshot.modes, mouseProtocol: "any" as const, mouseEncoding: encoding },
    };
    for (const lines of [3, 128, -128]) {
      const event = { ...wheel, data: { ...wheel.data, lines, row: 1000, col: 1000 } };
      const result = routeWheel(app, 0, event);
      assert.equal(result?.kind, "application");
      if (result?.kind !== "application") throw new Error("missing application route");
      const single = routeWheel(app, 0, {
        ...event,
        data: { ...event.data, lines: Math.sign(lines) },
      });
      if (single?.kind !== "application") throw new Error("missing report");
      const report = single.inputs[0]!.data;
      assert.equal(
        result.inputs.map((input) => input.data).join(""),
        report.repeat(Math.abs(lines)),
      );
      for (const input of result.inputs) {
        assert.equal(input.data.length % report.length, 0);
        assert.ok(input.data.length <= (input.kind === "bytes" ? 2048 : 1024));
      }
    }
  }
});
