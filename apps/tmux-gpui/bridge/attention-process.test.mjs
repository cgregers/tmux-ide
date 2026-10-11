// Actual helper wire lifecycle, private unavailable host; no daemon or GUI launched.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stopFixtureChild } from "./fixture-child.mjs";
test(
  "private-host attention preserves Home and fences scopes through background and navigation",
  { timeout: 15000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "gpui-attention-"));
    let child,
      fatal,
      buffer = "",
      latest;
    const env = { ...process.env, HOME: root, XDG_CONFIG_HOME: root, XDG_STATE_HOME: root };
    for (const key of Object.keys(env))
      if (key.startsWith("TMUX") || key === "NODE_OPTIONS" || key === "NODE_PATH") delete env[key];
    const wait = async (predicate) => {
      const deadline = Date.now() + 4000;
      for (;;) {
        if (fatal) throw fatal;
        if (predicate()) {
          if (fatal) throw fatal;
          return;
        }
        assert.ok(Date.now() < deadline, "publication deadline");
        await new Promise((r) => setTimeout(r, 5));
      }
    };
    const send = (value) => child.stdin.write(JSON.stringify(value) + "\n");
    let failure;
    try {
      child = spawn(
        process.execPath,
        [
          "--import",
          import.meta.resolve("tsx"),
          resolve("apps/tmux-gpui/bridge/browser.ts"),
          join(root, "missing-host.json"),
        ],
        { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] },
      );
      child.on("error", (error) => {
        fatal ??= error;
      });
      child.stdin.on("error", (error) => {
        fatal ??= error;
      });
      child.stderr.on("data", () => {});
      child.stdout.on("data", (chunk) => {
        try {
          buffer += chunk;
          assert.ok(Buffer.byteLength(buffer) <= 8 * 1024 * 1024);
          let end;
          while ((end = buffer.indexOf("\n")) >= 0) {
            latest = JSON.parse(buffer.slice(0, end));
            buffer = buffer.slice(end + 1);
          }
        } catch (error) {
          fatal ??= error;
        }
      });
      await wait(() => latest?.home?.phase === "unavailable");
      const connection = latest.connection;
      send({ type: "attention-observe", request: 0, scope: 1, active: true });
      await wait(() => latest?.attentionAgents?.scope === 1);
      assert.equal(latest.attentionSupported, true);
      assert.equal(latest.attentionAgents.phase, "unavailable");
      assert.equal(latest.surface, "home");
      assert.equal(latest.request, 0);
      assert.equal(latest.snapshot, null);
      assert.equal(latest.inputReady, false);
      send({ type: "attention-observe", request: 0, scope: 2, active: true });
      await wait(() => latest?.attentionAgents?.scope === 2);
      send({ type: "attention-observe", request: 0, scope: 1, active: false });
      send({ type: "presence", active: true, revision: 1 });
      await wait(() => latest?.presenceRevision === 1);
      assert.equal(latest.attentionAgents.scope, 2);
      send({ type: "presence", active: false, revision: 2 });
      await wait(() => latest?.presenceRevision === 2);
      assert.equal(latest.attentionAgents, null);
      send({ type: "presence", active: true, revision: 3 });
      send({ type: "attention-observe", request: 0, scope: 2, active: true });
      send({ type: "presence", active: true, revision: 4 });
      await wait(() => latest?.presenceRevision === 4);
      assert.equal(latest.attentionAgents, null);
      send({ type: "attention-observe", request: 0, scope: 3, active: true });
      await wait(() => latest?.attentionAgents?.scope === 3);
      send({ type: "home", request: 1 });
      await wait(() => latest?.request === 1);
      assert.equal(latest.attentionAgents, null);
      assert.equal(latest.connection, connection);
    } catch (error) {
      failure = error;
    } finally {
      try {
        if (child) await stopFixtureChild(child);
      } catch (error) {
        failure = failure ? new AggregateError([failure, error]) : error;
      }
      try {
        await rm(root, { recursive: true, force: true });
      } catch (error) {
        failure = failure ? new AggregateError([failure, error]) : error;
      }
    }
    if (failure) throw failure;
    if (fatal) throw fatal;
  },
);
