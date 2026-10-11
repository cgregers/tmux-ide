import { test } from "node:test";
import assert from "node:assert/strict";
import * as config from "./config.ts";
const route = { baseUrl: "http://127.0.0.1:43210", remoteSocketOrigin: "ws://127.0.0.1:4000" };
test("verified remote advertised socket uses tunnel while preserving issued path and query", () => {
  assert.equal(
    config.paneStreamSocketUrl(route, "ws://127.0.0.1:4000/ws/pane-stream?ticket=opaque"),
    "ws://127.0.0.1:43210/ws/pane-stream?ticket=opaque",
  );
});
test("wrong original origin, userinfo and fragment cannot be rebased", () => {
  for (const url of [
    "ws://127.0.0.1:4001/ws",
    "ws://127.0.0.1:43210/ws",
    "ws://user:secret@127.0.0.1:4000/ws",
    "ws://127.0.0.1:4000/ws#fragment",
    "wss://127.0.0.1:4000/ws",
  ])
    assert.throws(() => config.paneStreamSocketUrl(route, url));
});
test("direct route retains existing descriptor routing and hostname aliases", () => {
  assert.equal(
    config.paneStreamSocketUrl({ baseUrl: route.baseUrl }, "ws://127.0.0.1:43210/ws?ticket=x"),
    "ws://127.0.0.1:43210/ws?ticket=x",
  );
  assert.equal(
    config.paneStreamSocketUrl({ baseUrl: route.baseUrl }, "ws://localhost:43210/ws"),
    "ws://localhost:43210/ws",
  );
});

test("IPv6 remote origin is preserved and mapped to IPv4 tunnel", () => {
  assert.equal(
    config.paneStreamSocketUrl(
      { ...route, remoteSocketOrigin: "ws://[::1]:4000" },
      "ws://[::1]:4000/ws?x=y",
    ),
    "ws://127.0.0.1:43210/ws?x=y",
  );
});
