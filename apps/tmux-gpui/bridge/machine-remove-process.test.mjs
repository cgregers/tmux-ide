import process from "node:process";
import { Buffer } from "node:buffer";
import { setTimeout } from "node:timers";
// Actual browser + canonical saved-machine HTTP handler, private files only.
// Disabled profiles never initiate SSH; this is not remote-server qualification.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Hono } from "hono";
import { mountSavedMachineRoute } from "../../../packages/daemon/src/command-center/resources/saved-machine-route.ts";
import {
  updateSavedMachines,
  loadSavedMachines,
} from "../../../packages/daemon/src/lib/saved-machines.ts";
import { stopFixtureChild } from "./fixture-child.mjs";

test(
  "browser removal rejects stale/background commands, consumes one pending write, and preserves sibling profile",
  { timeout: 20000 },
  async () => {
    const root = await mkdtemp("/tmp/gpui-remove-");
    const path = join(root, "machines.json");
    const profiles = ["First", "Sibling"].map((label) => ({
      id: randomUUID(),
      label,
      sshTarget: `unused-${label.toLowerCase()}`,
      enabled: false,
    }));
    const scope = { serverId: `tmux-server.${"a".repeat(32)}`, generation: randomUUID() };
    const identity = { instanceId: randomUUID(), startedAt: "2026-10-11T00:00:00Z" };
    const token = "private-fixture-owner";
    const app = new Hono();
    mountSavedMachineRoute(app, {
      daemon: identity,
      ownerToken: token,
      read: () => loadSavedMachines(path),
      update: (change) => updateSavedMachines(change, path),
    });
    let fatal,
      latest,
      child,
      release,
      requests = 0,
      buffer = "",
      stderrBytes = 0;
    const errors = [];
    const server = createServer(async (req, res) => {
      try {
        if (req.url === "/api/resources/saved-machines") {
          requests++;
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            assert.ok(body.length <= 1024);
          }
          await new Promise((resolve) => {
            release = resolve;
          });
          const response = await app.request(req.url, {
            method: req.method,
            headers: req.headers,
            body,
          });
          res.writeHead(response.status, { "content-type": "application/json" });
          res.end(await response.text());
        } else {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ version: 1, server: scope, sessions: [] }));
        }
      } catch (error) {
        fatal ??= error;
        res.writeHead(500);
        res.end();
      }
    });
    const until = async (predicate) => {
      const deadline = Date.now() + 8000;
      for (;;) {
        if (fatal) throw fatal;
        const result = predicate();
        if (fatal) throw fatal;
        if (result) return result;
        assert.ok(Date.now() < deadline, "bounded publication deadline");
        assert.equal(child?.exitCode ?? null, null, "browser exited");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };
    const send = (command) => child.stdin.write(JSON.stringify(command) + "\n");
    let presence = 0;
    const barrier = async (active = true) => {
      const revision = ++presence;
      send({ type: "presence", active, revision });
      await until(() => latest?.presenceRevision === revision);
    };
    try {
      await writeFile(path, JSON.stringify({ version: 1, machines: profiles }), { mode: 0o600 });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const port = server.address().port;
      await writeFile(
        join(root, "daemon.json"),
        JSON.stringify({
          ...identity,
          pid: process.pid,
          port,
          protocolVersion: 2,
          productVersion: "fixture",
          bindHostname: "127.0.0.1",
          authToken: token,
        }),
        { mode: 0o600 },
      );
      const host = join(root, "host.json");
      await writeFile(
        host,
        JSON.stringify({ baseUrl: `http://127.0.0.1:${port}/`, ownerToken: token, scope }),
        { mode: 0o600 },
      );
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) =>
            !key.startsWith("TMUX") &&
            ![
              "NODE_OPTIONS",
              "NODE_PATH",
              "HOME",
              "XDG_CONFIG_HOME",
              "XDG_STATE_HOME",
              "XDG_CACHE_HOME",
              "TMPDIR",
            ].includes(key),
        ),
      );
      Object.assign(env, {
        HOME: root,
        TMUX_IDE_HOME: root,
        XDG_CONFIG_HOME: root,
        XDG_STATE_HOME: root,
        XDG_CACHE_HOME: root,
        TMPDIR: root,
      });
      child = spawn(
        process.execPath,
        ["--import", "tsx", resolve("apps/tmux-gpui/bridge/browser.ts"), host],
        { env, stdio: ["pipe", "pipe", "pipe"] },
      );
      child.on("error", (error) => {
        fatal ??= error;
      });
      child.stdin.on("error", (error) => {
        fatal ??= error;
      });
      child.stderr.on("data", (chunk) => {
        stderrBytes += chunk.length;
        if (stderrBytes > 65536) fatal ??= new Error("stderr bound");
      });
      child.stdout.on("data", (chunk) => {
        try {
          buffer += chunk;
          assert.ok(Buffer.byteLength(buffer) <= 1024 * 1024);
          let end;
          while ((end = buffer.indexOf("\n")) >= 0) {
            latest = JSON.parse(buffer.slice(0, end));
            buffer = buffer.slice(end + 1);
          }
        } catch (error) {
          fatal ??= error;
        }
      });
      await until(() => latest?.home.phase === "live");
      await barrier();
      send({ type: "machines", operation: "read", request: 0 });
      await until(() => latest?.machines?.available && latest.machines.machines.length === 2);
      const revision = latest.machines.revision;
      const remove = {
        type: "machines",
        operation: "mutate",
        request: 0,
        revision,
        change: { operation: "remove", id: profiles[0].id },
      };
      await barrier(false);
      send(remove);
      await barrier(false);
      assert.equal(requests, 0);
      await barrier();
      send({ ...remove, request: 1 });
      await barrier();
      assert.equal(requests, 0);
      send({ ...remove, revision: revision + 1 });
      await barrier();
      assert.equal(requests, 0);
      assert.deepEqual(JSON.parse(await readFile(path, "utf8")).machines, profiles);
      send(remove);
      await until(() => requests === 1 && latest?.machines?.pending && release);
      send(remove);
      await barrier();
      assert.equal(requests, 1);
      release();
      release = undefined;
      await until(() => !latest?.machines?.pending && latest?.machines?.machines.length === 1);
      assert.deepEqual(JSON.parse(await readFile(path, "utf8")).machines, [profiles[1]]);
      assert.deepEqual(latest.machines.machines, [profiles[1]]);
      send(remove);
      await barrier();
      assert.equal(requests, 1);
      assert.equal(latest.request, 0);
    } catch (error) {
      errors.push(error);
    } finally {
      release?.();
      if (child) {
        try {
          await stopFixtureChild(child);
        } catch (error) {
          errors.push(error);
        }
      }
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      try {
        await rm(root, { recursive: true, force: true });
      } catch (error) {
        errors.push(error);
      }
    }
    if (fatal && !errors.includes(fatal)) errors.push(fatal);
    if (errors.length) throw new AggregateError(errors, "Private remove verification failed");
  },
);
