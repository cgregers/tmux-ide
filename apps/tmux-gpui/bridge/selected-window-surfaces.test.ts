import assert from "node:assert/strict";
import { test } from "node:test";
import { blankTerminalReplicaSnapshot } from "../../../packages/core/src/terminal-replica.ts";
import type { Layout } from "./topology.ts";
import { selectedWindowSurfaces } from "./selected-window-surfaces.ts";

const layout = (id: string, panes: string[], currentWindow = false): Layout => ({
  type: "layout",
  semanticWindowId: id,
  windowName: id,
  currentWindow,
  cols: 291,
  rows: 90,
  zoomed: false,
  paneBorderStatus: "off",
  panes: panes.map((pane, index) => ({
    pane,
    left: index * 3,
    top: 0,
    width: 2,
    height: 2,
    active: index === 0,
  })),
});

test("offscreen windows cannot exhaust the publication budget; replicas remain resident", () => {
  const snapshot = blankTerminalReplicaSnapshot(291, 90);
  const surfaces = new Map(Array.from({ length: 12 }, (_, i) => [`pane-${i}`, snapshot]));
  const layouts = [...surfaces.keys()].map((pane, i) => layout(`window-${i}`, [pane], i === 0));
  const oldLine = JSON.stringify({
    snapshot,
    surfaces: [...surfaces].map(([paneId, snapshot]) => ({ paneId, snapshot })),
  });
  assert.ok(Buffer.byteLength(oldLine) > 8 * 1024 * 1024);
  const projected = selectedWindowSurfaces(layouts, "pane-7", surfaces);
  assert.deepEqual(
    projected.map((row) => row.paneId),
    ["pane-7"],
  );
  assert.ok(Buffer.byteLength(JSON.stringify({ snapshot, surfaces: projected })) < 8 * 1024 * 1024);
  assert.equal(surfaces.size, 12);
  assert.equal(selectedWindowSurfaces(layouts, "pane-11", surfaces)[0].snapshot, snapshot);
});

test("selected non-current window includes every sibling and no other tab", () => {
  const snapshot = blankTerminalReplicaSnapshot(2, 2);
  const surfaces = new Map(["a", "b", "c"].map((pane) => [pane, snapshot]));
  const layouts = [layout("active", ["a"], true), layout("selected", ["b", "c"])];
  assert.deepEqual(
    selectedWindowSurfaces(layouts, "c", surfaces).map((row) => row.paneId),
    ["b", "c"],
  );
  surfaces.delete("b");
  assert.deepEqual(
    selectedWindowSurfaces(layouts, "c", surfaces).map((row) => row.paneId),
    ["c"],
  );
  assert.deepEqual(selectedWindowSurfaces(layouts, "missing", surfaces), []);
  assert.deepEqual(
    selectedWindowSurfaces([...layouts, layout("duplicate", ["c"])], "c", surfaces),
    [],
  );
  assert.deepEqual(selectedWindowSurfaces([layout("duplicate", ["c", "c"])], "c", surfaces), []);
});
