import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  emptyFleetClientState,
  changeFleetClientState,
} from "../../../packages/core/src/fleet-client-state.ts";
import type { MachineCatalogGroup } from "../../../packages/daemon/src/lib/machine-catalog.ts";
import { FleetClientStateRequestSchema } from "../../../packages/contracts/src/fleet-client-state.ts";
import { createFleetPreferences } from "./fleet-preferences.ts";
import { createFleetPreferencePublication } from "./fleet-preference-publication.ts";
function group(id: string, count: number): MachineCatalogGroup {
  return {
    id,
    label: "Duplicate machine",
    state: "ready",
    note: null,
    environmentId: randomUUID(),
    sessions: Array.from({ length: count }, (_, i) => ({
      id: `${id}-${i}`,
      machineId: id,
      sourceId: `source-${i}`,
      name: "Duplicate session",
      paneCount: 1,
      disabled: false,
    })),
  };
}
async function fixture() {
  let state = emptyFleetClientState();
  const daemon = {
    protocolVersion: 1,
    productVersion: "test",
    instanceId: randomUUID(),
    startedAt: "2026-10-13T00:00:00Z",
  };
  const writes: unknown[] = [];
  let release: (() => void) | undefined;
  let defer = false;
  const owner = {
    kind: "local" as const,
    ...daemon,
    assertCurrent() {},
    async request(input: { method: "GET" | "POST"; body?: string; signal: AbortSignal }) {
      if (input.body) {
        const change = FleetClientStateRequestSchema.parse(JSON.parse(input.body)).change;
        writes.push(change);
        if (defer) await new Promise<void>((resolve) => (release = resolve));
        state = changeFleetClientState(state, change);
      }
      return Response.json({ daemon, state });
    },
  };
  const adapter = createFleetPreferences({ getLocalOwner: () => owner });
  await adapter.refresh();
  const publication = createFleetPreferencePublication(adapter);
  return {
    adapter,
    publication,
    writes,
    seed: async (favorites: string[]) => {
      state = { ...state, favorites };
      await adapter.refresh();
    },
    defer() {
      defer = true;
    },
    release() {
      release!();
    },
  };
}
test("opaque actions use canonical identity, consume once and wait for acknowledgement", async () => {
  const f = await fixture();
  const g = group("ssh-route", 2);
  f.publication.begin([g], g.sessions[0]!.id);
  const meta = f.publication.metadata()!;
  const row = f.publication.session(g.sessions[1]!);
  const collapse = f.publication.group(g);
  assert.equal(row.favorite, false);
  assert.equal(f.publication.session(g.sessions[0]!).active, true);
  const cmd = {
    type: "fleet-preference",
    request: 7,
    revision: meta.revision,
    action: row.favoriteAction,
    enabled: true,
  };
  assert.equal(await f.publication.command(cmd, { request: 8, foreground: true }), false);
  assert.equal(await f.publication.command(cmd, { request: 7, foreground: false }), false);
  f.defer();
  const pending = f.publication.command(cmd, { request: 7, foreground: true });
  assert.equal(await f.publication.command(cmd, { request: 7, foreground: true }), false);
  f.publication.begin([g], null);
  assert.equal(f.publication.metadata()!.phase, "saving");
  assert.equal(f.publication.session(g.sessions[1]!).favorite, false);
  assert.equal(f.publication.group(g).collapseAction, null);
  f.release();
  assert.equal(await pending, true);
  assert.deepEqual(f.writes, [{ type: "favorite", key: g.sessions[1]!.id, enabled: true }]);
  f.publication.begin([g], null);
  assert.equal(f.publication.session(g.sessions[1]!).favorite, true);
  assert.equal(
    await f.publication.command(
      { ...cmd, action: collapse.collapseAction },
      { request: 7, foreground: true },
    ),
    false,
  );
  f.adapter.dispose();
});
test("collapse targets environment identity and removed/reprojected capabilities refuse", async () => {
  const f = await fixture();
  const g = group("ssh-route", 1);
  f.publication.begin([g], null);
  const cmd = {
    type: "fleet-preference",
    request: 0,
    revision: f.publication.metadata()!.revision,
    action: f.publication.group(g).collapseAction,
    enabled: true,
  };
  assert.equal(await f.publication.command(cmd, { request: 0, foreground: true }), true);
  assert.deepEqual(f.writes, [{ type: "collapse", key: g.environmentId, enabled: true }]);
  f.publication.begin([g], null);
  assert.equal(f.publication.group(g).collapsed, true);
  const action = f.publication.session(g.sessions[0]!).favoriteAction;
  f.publication.begin([], null);
  assert.equal(
    await f.publication.command(
      { ...cmd, revision: f.publication.metadata()!.revision, action },
      { request: 0, foreground: true },
    ),
    false,
  );
  f.adapter.dispose();
});
test("active and favorites survive group, per-group and global caps", async () => {
  const f = await fixture();
  const groups = Array.from({ length: 66 }, (_, i) => group(`machine-${i}`, 140));
  const favorite = groups[65]!.sessions[139]!.id,
    active = groups[64]!.sessions[138]!.id;
  await f.seed([favorite]);
  const selected = f.publication.begin(groups, active);
  assert.equal(selected.length, 64);
  assert.equal(selected.flatMap((g) => g.sessions).length, 512);
  assert.ok(selected.some((g) => g.sessions.some((s) => s.id === favorite)));
  assert.ok(selected.some((g) => g.sessions.some((s) => s.id === active)));
  assert.ok(selected.every((g) => g.sessions.length <= 128));
  f.adapter.dispose();
});
test("catalog replacement advances action epoch so refused old action cannot strand current controls", async () => {
  const f = await fixture();
  const g = group("same", 1);
  f.publication.begin([g], null);
  const old = {
    type: "fleet-preference",
    request: 2,
    revision: f.publication.metadata()!.revision,
    action: f.publication.session(g.sessions[0]!).favoriteAction,
    enabled: true,
  };
  f.publication.begin([g], null);
  assert.ok(f.publication.metadata()!.revision > old.revision);
  assert.equal(await f.publication.command(old, { request: 2, foreground: true }), false);
  assert.equal(f.writes.length, 0);
  assert.equal(
    await f.publication.command(
      {
        ...old,
        revision: f.publication.metadata()!.revision,
        action: f.publication.session(g.sessions[0]!).favoriteAction,
      },
      { request: 2, foreground: true },
    ),
    true,
  );
  assert.equal(f.writes.length, 1);
  f.adapter.dispose();
});
