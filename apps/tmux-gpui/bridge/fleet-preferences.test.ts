import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  changeFleetClientState,
  emptyFleetClientState,
} from "../../../packages/core/src/fleet-client-state.ts";
import { FleetClientStateRequestSchema } from "../../../packages/contracts/src/fleet-client-state.ts";
import {
  createFleetPreferences,
  FLEET_PREFERENCE_RESPONSE_BYTES,
  type VerifiedLocalFleetPreferenceOwner,
} from "./fleet-preferences.ts";
function fixture() {
  let valid = true;
  let state = emptyFleetClientState();
  const daemon = {
    protocolVersion: 1,
    productVersion: "test",
    instanceId: randomUUID(),
    startedAt: new Date().toISOString(),
  };
  const calls: string[] = [];
  const owner: VerifiedLocalFleetPreferenceOwner = {
    kind: "local",
    instanceId: daemon.instanceId,
    startedAt: daemon.startedAt,
    assertCurrent() {
      if (!valid) throw new Error("private diagnostic must not escape");
    },
    async request(input) {
      calls.push(input.method);
      if (input.body)
        state = changeFleetClientState(
          state,
          FleetClientStateRequestSchema.parse(JSON.parse(input.body)).change,
        );
      return Response.json({ daemon, state });
    },
  };
  let selected: VerifiedLocalFleetPreferenceOwner | null = owner;
  const adapter = createFleetPreferences({ getLocalOwner: () => selected });
  return {
    adapter,
    owner,
    daemon,
    calls,
    retire: () => {
      valid = false;
    },
    replace: () => {
      selected = { ...owner };
    },
  };
}
test("construction does no IO; acknowledged explicit preferences are idempotent and snapshots detached", async () => {
  const f = fixture();
  assert.deepEqual(f.calls, []);
  assert.equal(f.adapter.snapshot().state, null);
  assert.equal(await f.adapter.refresh(), true);
  for (const enabled of [true, true, false, false]) {
    assert.equal(
      await f.adapter.change(f.adapter.snapshot().revision, {
        type: "favorite",
        key: "exact session",
        enabled,
      }),
      true,
    );
    assert.deepEqual(f.adapter.snapshot().state?.favorites, enabled ? ["exact session"] : []);
  }
  const snapshot = f.adapter.snapshot();
  snapshot.state!.favorites.push("injected");
  assert.deepEqual(f.adapter.snapshot().state?.favorites, []);
  assert.equal(
    await f.adapter.change(snapshot.revision - 1, { type: "collapse", key: "host", enabled: true }),
    false,
  );
  assert.equal(await f.adapter.change(snapshot.revision, { type: "visit", key: "session" }), false);
  assert.equal(await f.adapter.change(snapshot.revision, undefined), false);
  f.adapter.dispose();
});
test("one pending write, no optimistic state or replay after uncertain failure", async () => {
  const f = fixture();
  await f.adapter.refresh();
  let fail!: (error: Error) => void;
  f.owner.request = async () => {
    f.calls.push("POST");
    return new Promise<Response>((_, reject) => {
      fail = reject;
    });
  };
  const revision = f.adapter.snapshot().revision;
  const pending = f.adapter.change(revision, { type: "favorite", key: "one", enabled: true });
  assert.equal(f.adapter.snapshot().phase, "saving");
  assert.deepEqual(f.adapter.snapshot().state?.favorites, []);
  assert.equal(
    await f.adapter.change(revision, { type: "favorite", key: "two", enabled: true }),
    false,
  );
  assert.equal(await f.adapter.refresh(), false);
  fail(new Error("secret path"));
  assert.equal(await pending, false);
  assert.equal(f.adapter.snapshot().state, null);
  assert.equal(f.adapter.snapshot().phase, "failed");
  assert.doesNotMatch(f.adapter.snapshot().error!, /secret/);
  assert.equal(
    await f.adapter.change(f.adapter.snapshot().revision, {
      type: "favorite",
      key: "one",
      enabled: true,
    }),
    false,
  );
  assert.deepEqual(f.calls, ["GET", "POST"]);
  f.adapter.dispose();
});
test("local kind, retired owner, owner replacement and response identity fail closed", async () => {
  for (const mutation of ["remote", "retired", "replacement", "response", "inplace"] as const) {
    const f = fixture();
    if (mutation === "remote") Object.assign(f.owner, { kind: "ssh" });
    else {
      const original = f.owner.request;
      f.owner.request = async (input) => {
        const response = await original(input);
        if (mutation === "retired") f.retire();
        if (mutation === "replacement") f.replace();
        if (mutation === "inplace")
          Object.assign(f.owner, { startedAt: "2025-01-01T00:00:00.000Z" });
        if (mutation === "response")
          return Response.json({
            daemon: { ...f.daemon, instanceId: randomUUID() },
            state: emptyFleetClientState(),
          });
        return response;
      };
    }
    assert.equal(await f.adapter.refresh(), false, mutation);
    assert.equal(f.adapter.snapshot().state, null);
    if (mutation === "remote") assert.deepEqual(f.calls, []);
    f.adapter.dispose();
  }
  const f = fixture();
  await f.adapter.refresh();
  f.replace();
  assert.equal(f.adapter.snapshot().phase, "unavailable");
  assert.equal(f.adapter.snapshot().state, null);
  f.adapter.dispose();
});
test("abort and disposal reject late completion without publishing acknowledged data", async () => {
  for (const dispose of [false, true]) {
    const f = fixture();
    let finish!: (value: Response) => void;
    f.owner.request = async () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      });
    const abort = new AbortController();
    const pending = f.adapter.refresh(abort.signal);
    if (dispose) f.adapter.dispose();
    else abort.abort();
    assert.equal(await pending, false);
    finish(Response.json({ daemon: f.daemon, state: emptyFleetClientState() }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(f.adapter.snapshot().state, null);
    f.adapter.dispose();
  }
});
test("streamed response bound cancels oversized data and accepts a populated shared catalog", async () => {
  const f = fixture();
  let cancelled = false;
  f.owner.request = async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(1024 * 1024));
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
  assert.equal(await f.adapter.refresh(), false);
  assert.equal(cancelled, true);
  assert.equal(FLEET_PREFERENCE_RESPONSE_BYTES, 64 * 1024 * 1024);
  const state = emptyFleetClientState();
  state.catalog = Array.from({ length: 64 }, () => ({
    routeId: "local",
    environmentId: null,
    generation: null,
    seenAt: 1,
    sessions: Array.from({ length: 64 }, () => ({
      id: "界".repeat(1024),
      liveSessionId: "界".repeat(1024),
      name: "界".repeat(255),
      paneCount: 1,
    })),
  }));
  f.owner.request = async () => Response.json({ daemon: f.daemon, state });
  assert.equal(await f.adapter.refresh(), true);
  assert.equal(f.adapter.snapshot().state?.catalog.length, 64);
  f.adapter.dispose();
});
test("real isolated HTTP transport uses GET and explicit POST expected instance, never automatic retry", async () => {
  const f = fixture();
  let state = emptyFleetClientState();
  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    requests.push(req.method!);
    if (req.headers.authorization !== "Bearer private-test") {
      res.writeHead(401).end();
      return;
    }
    if (req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const parsed = FleetClientStateRequestSchema.parse(JSON.parse(body));
      assert.equal(parsed.expectedInstanceId, f.daemon.instanceId);
      state = changeFleetClientState(state, parsed.change);
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ daemon: f.daemon, state }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    f.owner.request = (input) =>
      fetch(`http://127.0.0.1:${address.port}/api/resources/fleet-client-state`, {
        ...input,
        redirect: "error",
        headers: { Authorization: "Bearer private-test", "Content-Type": "application/json" },
      });
    assert.equal(await f.adapter.refresh(), true);
    assert.equal(
      await f.adapter.change(f.adapter.snapshot().revision, {
        type: "collapse",
        key: "machine-id",
        enabled: true,
      }),
      true,
    );
    assert.deepEqual(state.collapsed, ["machine-id"]);
    assert.deepEqual(requests, ["GET", "POST"]);
  } finally {
    f.adapter.dispose();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("late retired response is cancelled and changed owner cannot expose old state during refresh", async () => {
  const f = fixture();
  await f.adapter.refresh();
  await f.adapter.change(f.adapter.snapshot().revision, {
    type: "favorite",
    key: "previous owner",
    enabled: true,
  });
  let cancelled = false;
  let finish!: (response: Response) => void;
  f.owner.request = async () =>
    new Promise<Response>((resolve) => {
      finish = resolve;
    });
  const pending = f.adapter.refresh();
  f.retire();
  finish(
    new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
    ),
  );
  assert.equal(await pending, false);
  assert.equal(cancelled, true);
  assert.equal(f.adapter.snapshot().state, null);
  f.adapter.dispose();
  const next = fixture();
  await next.adapter.refresh();
  next.replace();
  const refresh = next.adapter.refresh();
  assert.equal(next.adapter.snapshot().state, null);
  assert.equal(await refresh, true);
  next.adapter.dispose();
});

test("throwing observer cannot strand writes or escape the result contract", async () => {
  const f = fixture();
  let notifications = 0;
  const adapter = createFleetPreferences({
    getLocalOwner: () => f.owner,
    changed() {
      notifications++;
      throw new Error("private observer error");
    },
  });
  assert.equal(await adapter.refresh(), true);
  assert.equal(
    await adapter.change(adapter.snapshot().revision, {
      type: "favorite",
      key: "one",
      enabled: true,
    }),
    true,
  );
  assert.equal(await adapter.refresh(), true);
  assert.deepEqual(adapter.snapshot().state?.favorites, ["one"]);
  assert.equal(notifications, 6);
  assert.deepEqual(f.calls, ["GET", "POST", "GET"]);
  adapter.dispose();
  f.adapter.dispose();
});
