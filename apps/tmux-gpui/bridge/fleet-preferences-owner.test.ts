import { test } from "node:test";
import assert from "node:assert/strict";
import type { MachineConnectionHandle } from "../../../packages/daemon/src/lib/machine-connection-manager.ts";
import { createLocalFleetPreferenceOwner } from "./fleet-preferences-owner.ts";

function fixture() {
  let info = {
    pid: 1,
    port: 4000,
    bindHostname: "127.0.0.1" as const,
    protocolVersion: 2,
    productVersion: "fixture",
    instanceId: "835efdf7-4dce-4bf3-9407-08319812fa3c",
    startedAt: "2026-10-13T00:00:00Z",
    authToken: "private-fixture-token",
  };
  let epoch = 0;
  const local: MachineConnectionHandle = {
    id: "local",
    kind: "local",
    label: "Local",
    ready: Promise.resolve(true),
    read: () => info,
    isAlive: async () => true,
    observe: async () => () => {},
    endpoint: () => ({
      kind: "local",
      label: null,
      remote: null,
      localBaseUrl: null,
      epoch,
      state: "ready",
    }),
  };
  let handle: MachineConnectionHandle | null = local;
  const lookups: string[] = [];
  return {
    manager: {
      getMachine(id: string) {
        lookups.push(id);
        return handle;
      },
    },
    lookups,
    local,
    replace: () => {
      handle = { ...local };
    },
    remote: () => {
      handle = { ...local, kind: "ssh" };
    },
    remove: () => {
      handle = null;
    },
    changeEpoch: () => {
      epoch++;
    },
    rotateToken: () => {
      info = { ...info, authToken: "replacement-token" };
    },
    mutateRecord: () => {
      info.port = 9999;
      info.authToken = "mutated-token";
    },
  };
}

test("local preference owner remains stable and never resolves selected remote authority", async () => {
  const f = fixture();
  const calls: { url: string; init?: RequestInit }[] = [];
  const get = createLocalFleetPreferenceOwner(f.manager, async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response("{}");
  });
  const owner = get()!;
  assert.equal(get(), owner);
  await owner.request({ method: "POST", body: "{}", signal: new AbortController().signal });
  assert.deepEqual(new Set(f.lookups), new Set(["local"]));
  assert.equal(calls[0].url, "http://127.0.0.1:4000/api/resources/fleet-client-state");
  assert.equal(calls[0].init?.redirect, "error");
  assert.equal(
    new Headers(calls[0].init?.headers).get("Authorization"),
    "Bearer private-fixture-token",
  );
});

test("replacement, epoch and token changes retire old owners before any network write", async () => {
  for (const change of [
    "replace",
    "changeEpoch",
    "rotateToken",
    "mutateRecord",
    "remove",
    "remote",
  ] as const) {
    const f = fixture();
    let calls = 0;
    const get = createLocalFleetPreferenceOwner(f.manager, async () => {
      calls++;
      return new Response("{}");
    });
    const before = get()!;
    f[change]();
    assert.throws(() => before.assertCurrent());
    await assert.rejects(
      before.request({ method: "POST", body: "{}", signal: new AbortController().signal }),
    );
    assert.equal(calls, 0);
    assert.notEqual(get(), before);
    if (change === "remove" || change === "remote") assert.equal(get(), null);
  }
});

test("owner replacement during response cancels the body and refuses acknowledgement", async () => {
  const f = fixture();
  let cancelled = false;
  const get = createLocalFleetPreferenceOwner(f.manager, async () => {
    f.replace();
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
    );
  });
  await assert.rejects(get()!.request({ method: "GET", signal: new AbortController().signal }));
  assert.equal(cancelled, true);
});

test("already cancelled requests perform no HTTP work", async () => {
  const f = fixture();
  let calls = 0;
  const get = createLocalFleetPreferenceOwner(f.manager, async () => {
    calls++;
    return new Response("{}");
  });
  await assert.rejects(get()!.request({ method: "GET", signal: AbortSignal.abort() }));
  assert.equal(calls, 0);
});

test("caller cannot replace the captured cancellation signal while a response is pending", async () => {
  const f = fixture();
  let finish!: (response: Response) => void;
  let cancelled = false;
  const get = createLocalFleetPreferenceOwner(
    f.manager,
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const input = { method: "GET" as const, signal: controller.signal };
  const pending = get()!.request(input);
  controller.abort();
  input.signal = new AbortController().signal;
  finish(
    new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
    ),
  );
  await assert.rejects(pending);
  assert.equal(cancelled, true);
});
