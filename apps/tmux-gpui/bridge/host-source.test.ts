import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDaemonConnectionOwner } from "../../../packages/daemon/src/lib/daemon-connection-owner.ts";
import { DAEMON_WIRE_PROTOCOL_VERSION } from "../../../packages/contracts/src/index.ts";
import { createRemotePreviewRoute } from "./remote-route.ts";
import { createPreviewHostSource, remoteHostConfigSchema } from "./host-source.ts";

function fixture() {
  const daemon = {
    environmentId: randomUUID(),
    pid: 1234,
    port: 4000,
    protocolVersion: DAEMON_WIRE_PROTOCOL_VERSION,
    productVersion: "2.9.5",
    instanceId: randomUUID(),
    startedAt: new Date().toISOString(),
    bindHostname: "127.0.0.1" as const,
    authToken: "test-private-token",
  };
  const host = {
    baseUrl: "http://127.0.0.1:43210",
    ownerToken: daemon.authToken,
    scope: {
      serverId: `tmux-server.${randomUUID().replaceAll("-", "")}`,
      generation: randomUUID(),
    },
  };
  let config: unknown = { sshTarget: "test-machine" };
  let dials = 0,
    disposed = 0,
    retired = 0;
  const owners: ReturnType<typeof createDaemonConnectionOwner>[] = [];
  const dependencies = {
    readConfig: () => config,
    discover: async () => host,
    createOwner() {
      const owner = createDaemonConnectionOwner({
        readLocal: () => null,
        isLocalAlive: async () => false,
        observeLocal: async () => () => {},
        connect: async () => {
          dials++;
          return {
            daemon,
            baseUrl: host.baseUrl,
            closed: new Promise<void>(() => {}),
            dispose: () => {
              disposed++;
            },
          };
        },
      });
      owners.push(owner);
      return owner;
    },
    route: (
      owner: Parameters<typeof createRemotePreviewRoute>[0],
      options: Parameters<typeof createRemotePreviewRoute>[1],
    ) =>
      createRemotePreviewRoute(owner, {
        ...options,
        request: async (url) => {
          if (String(url).endsWith("/identity")) return Response.json({ ...daemon, ok: true });
          if (String(url).endsWith("/capabilities"))
            return Response.json({
              status: "ok",
              daemon: {
                environmentId: daemon.environmentId,
                protocolVersion: daemon.protocolVersion,
                productVersion: daemon.productVersion,
                instanceId: daemon.instanceId,
                startedAt: daemon.startedAt,
              },
              capabilities: { appWindowMutation: { available: false, reason: "not supported" } },
            });
          return Response.json({
            version: 1,
            servers: [{ ...host.scope, label: "test", state: "online" }],
          });
        },
      }),
  };
  return {
    host,
    daemon,
    dependencies,
    owners,
    setConfig: (next: unknown) => {
      config = next;
    },
    counts: () => ({ dials, disposed, retired }),
    source(argument = "private.json") {
      return createPreviewHostSource(
        argument,
        () => {
          retired++;
        },
        dependencies,
      );
    },
  };
}

test("native host source reuses SSH across Home refresh and retires exactly once on disconnect", async () => {
  const f = fixture();
  const source = f.source();
  try {
    assert.deepEqual(await source.read(), f.host);
    assert.deepEqual(await source.read(), f.host);
    assert.deepEqual(f.counts(), { dials: 1, disposed: 0, retired: 0 });
    f.owners[0]!.disconnect();
    assert.deepEqual(f.counts(), { dials: 1, disposed: 1, retired: 1 });
    assert.deepEqual(await source.read(), f.host);
    assert.equal(f.counts().dials, 2);
  } finally {
    source.dispose();
  }
  assert.deepEqual(f.counts(), { dials: 2, disposed: 2, retired: 1 });
  await assert.rejects(source.read(), /connection changed/);
});

test("switching private target disposes old transport without an unsolicited retirement event", async () => {
  const f = fixture();
  const source = f.source();
  try {
    await source.read();
    f.setConfig({ sshTarget: "another-machine" });
    await source.read();
    assert.deepEqual(f.counts(), { dials: 2, disposed: 1, retired: 0 });
    f.setConfig(f.host);
    await source.read();
    assert.deepEqual(f.counts(), { dials: 2, disposed: 2, retired: 0 });
  } finally {
    source.dispose();
  }
});

test("local and explicit private hosts do not create an SSH owner", async () => {
  for (const local of [false, true]) {
    const f = fixture();
    f.setConfig(f.host);
    const source = f.source(local ? "--local" : "private.json");
    try {
      assert.deepEqual(await source.read(), f.host);
    } finally {
      source.dispose();
    }
    assert.deepEqual(f.counts(), { dials: 0, disposed: 0, retired: 0 });
  }
});

test("late route completion after source disposal cannot publish or leak a route", async () => {
  const f = fixture();
  const original = f.dependencies.route;
  let entered!: () => void, release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let aborted: AbortSignal | undefined;
  f.dependencies.route = async (...args) => {
    const route = await original(...args);
    aborted = route.signal;
    entered();
    await gate;
    return route;
  };
  const source = f.source();
  const pending = source.read();
  await waiting;
  source.dispose();
  release();
  await assert.rejects(pending, /connection changed/);
  assert.equal(aborted?.aborted, true);
  assert.deepEqual(f.counts(), { dials: 1, disposed: 1, retired: 0 });
});

test("machine file uses the shared SSH target and environment identity constraints", () => {
  assert.equal(remoteHostConfigSchema.safeParse({ sshTarget: "user@build" }).success, true);
  for (const value of [
    { sshTarget: "-oProxyCommand=bad" },
    { sshTarget: "host\ncommand" },
    { sshTarget: "host", expectedEnvironmentId: "wrong" },
    { sshTarget: "host", token: "no" },
  ])
    assert.equal(remoteHostConfigSchema.safeParse(value).success, false);
});

test("native machine selection replaces owned SSH and can return to local discovery", async () => {
  const f = fixture();
  const source = f.source();
  try {
    await source.read();
    source.select("another-machine");
    assert.equal(f.counts().disposed, 1);
    await source.read();
    assert.equal(f.counts().dials, 2);
    source.select(null);
    assert.equal(f.counts().disposed, 2);
    assert.deepEqual(await source.read(), f.host);
    assert.equal(f.counts().dials, 2);
    assert.throws(() => source.select("-bad-target"));
  } finally {
    source.dispose();
  }
});

test("saved selection carries its environment pin into the shared SSH owner", async () => {
  const f = fixture();
  const source = f.source();
  try {
    source.select("build", f.daemon.environmentId);
    assert.deepEqual(await source.read(), f.host);
    source.select("build", randomUUID());
    await assert.rejects(source.read(), /unavailable/);
    assert.equal(f.counts().disposed, 2);
    source.select("build", f.daemon.environmentId);
    assert.deepEqual(await source.read(), f.host);
  } finally {
    source.dispose();
  }
});
