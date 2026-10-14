// Opt-in real-process regression. Usage: node --import tsx THIS APP CLI TMUX FRESH_RECEIPT
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import console from "node:console";
import { spawn, execFileSync } from "node:child_process";
import { access, stat, readFile, writeFile, mkdir, readdir, rm, realpath } from "node:fs/promises";
import { constants, existsSync, writeFileSync } from "node:fs";
import { join, dirname, basename, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { setTimeout as delay } from "node:timers/promises";
import { createScratchFleet } from "../../../scripts/lib/product-fixtures/scratch-fleet.ts";
import { listTmuxServers } from "../../../packages/daemon-client/src/tmux-server-client.ts";
import { stopFixtureChild } from "./fixture-child.mjs";

const [app, cli, tmuxBinary, receipt] = process.argv.slice(2);
for (const path of [app, cli, tmuxBinary, receipt])
  assert.ok(path && isAbsolute(path), "explicit absolute artifacts and receipt required");
assert.ok((await stat(app)).isDirectory());
assert.ok(!existsSync(receipt), "receipt must be fresh");
assert.equal(
  basename(tmuxBinary),
  "tmux",
  "explicit binary must resolve through scratch fixture PATH",
);
const node = await realpath(join(app, "Contents/Resources/node"));
const entry = await realpath(join(app, "Contents/Resources/bridge/browser.bundle.mjs"));
const live = await realpath(join(app, "Contents/Resources/bridge/live.bundle.mjs"));
const artifacts = {};
for (const [name, path] of Object.entries({ node, browser: entry, live, cli, tmux: tmuxBinary })) {
  assert.ok((await stat(path)).isFile());
  await access(path, [node, tmuxBinary].includes(path) ? constants.X_OK : constants.R_OK);
  artifacts[name] = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}
for (const key of Object.keys(process.env))
  if (key.startsWith("TMUX") || ["NODE_OPTIONS", "NODE_PATH"].includes(key))
    delete process.env[key];
process.env.PATH = `${dirname(tmuxBinary)}:${dirname(node)}:/usr/bin:/bin:/usr/sbin:/sbin`;
let fleet, env, daemon, browser, latest, before, privateTmp;
let fatal = null,
  closing = false,
  phase = "setup",
  sequence = 0,
  count = 0,
  stderrBytes = 0;
let retirementProved = false,
  sourcePreserved = false,
  cleaned = false,
  triggerSequence = null;
const errors = [],
  trace = [],
  helperPids = new Set();
const deadline = Date.now() + 60000;
const cancel = () => {
  fatal ??= "cancelled";
};
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
function check() {
  if (fatal) throw Error(fatal);
  assert.ok(Date.now() < deadline, "total-deadline");
  if (browser) assert.ok(browser.exitCode === null && browser.signalCode === null, "browser-alive");
}
async function until(predicate, milliseconds = 10000) {
  const end = Math.min(deadline, Date.now() + milliseconds);
  while (true) {
    check();
    if (await predicate()) {
      check();
      return;
    }
    assert.ok(Date.now() < end, "phase-deadline");
    await delay(20);
  }
}
const run = (binary, args, options = {}) =>
  execFileSync(binary, args, {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
const tmux = (...args) => run(tmuxBinary, ["-S", fleet.socketPath, ...args], { env });
const source = () =>
  tmux("list-panes", "-a", "-F", "#{pane_id}|#{pane_pid}|#{pane_birth_id}")
    .trim()
    .split("\n")
    .sort();
function helpers() {
  if (!privateTmp) return [];
  const rows = run("/bin/ps", ["-axo", "pid=,ppid=,command="])
    .split("\n")
    .flatMap((line) => {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
      return m ? [{ pid: Number(m[1]), parent: Number(m[2]), command: m[3] }] : [];
    })
    .filter((p) => p.command.includes(live) && p.command.includes(`${privateTmp}/tmux-gpui-pane-`));
  for (const p of rows) helperPids.add(p.pid);
  return rows;
}
async function stopHelpers() {
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    for (const p of helpers()) {
      const current = helpers().find((row) => row.pid === p.pid);
      if (current?.command === p.command)
        try {
          process.kill(p.pid, signal);
        } catch (e) {
          if (e.code !== "ESRCH") throw e;
        }
    }
    const end = Date.now() + 1000;
    while (helpers().length && Date.now() < end) await delay(20);
    if (!helpers().length) break;
  }
  assert.equal(helpers().length, 0);
}
function own(child) {
  child.on("error", () => {
    fatal ??= "child-error";
  });
  child.on("exit", () => {
    if (!closing) fatal ??= "child-early-exit";
  });
  for (const stream of [child.stdin, child.stdout, child.stderr].filter(Boolean))
    stream.on("error", () => {
      if (!closing) fatal ??= "child-stream-error";
    });
  child.stderr?.on("data", (bytes) => {
    stderrBytes += bytes.length;
    if (stderrBytes > 65536) fatal ??= "stderr-bound";
  });
  return child;
}
function send(value) {
  assert.ok(["presence", "session", "appearance"].includes(value.type), "no-pane-or-input-command");
  assert.ok(browser.stdin.writable && browser.stdin.writableLength < 65536);
  browser.stdin.write(JSON.stringify(value) + "\n");
}
try {
  fleet = await createScratchFleet({ sessions: 1, windowsPerSession: 1, slug: "catalog-ack" });
  assert.equal(await realpath(fleet.environment.TMUX_IDE_TMUX_BIN), await realpath(tmuxBinary));
  const canonical = join(fleet.root, "canonical");
  privateTmp = join(fleet.root, "tmp");
  await mkdir(canonical, { mode: 0o700 });
  await mkdir(privateTmp, { mode: 0o700 });
  privateTmp = await realpath(privateTmp);
  env = {
    ...fleet.environment,
    TMUX: "",
    TMPDIR: privateTmp,
    TMUX_IDE_DAEMON_INFO_DIR: canonical,
    TMUX_IDE_REGISTRY_DIR: canonical,
    TMUX_IDE_TMUX_SOCKET_PATH: fleet.socketPath,
  };
  delete env.TMUX_IDE_TMUX_SOCKET_NAME;
  before = source();
  phase = "daemon-start";
  daemon = own(
    spawn(node, [cli, "--headless"], {
      cwd: fleet.projectDir,
      env,
      stdio: ["ignore", "ignore", "pipe"],
    }),
  );
  let info;
  await until(async () => {
    try {
      const path = join(canonical, "daemon.json");
      assert.ok((await stat(path)).size < 65536);
      const value = JSON.parse(await readFile(path, "utf8"));
      if (value.pid !== daemon.pid) return false;
      info = value;
      return true;
    } catch {
      return false;
    }
  }, 20000);
  phase = "scoped-host";
  const options = {
    baseUrl: `http://127.0.0.1:${info.port}/`,
    ownerToken: info.authToken,
    hostClientId: "catalog-presence-smoke",
    origin: "tmux-ide://app",
    fetch: (url, init) =>
      globalThis.fetch(url, {
        ...init,
        signal: globalThis.AbortSignal.timeout(5000),
        redirect: "error",
      }),
  };
  const servers = (await listTmuxServers(options)).servers.filter((s) => s.state === "online");
  assert.equal(servers.length, 1, "one-owned-server");
  const scope = { serverId: servers[0].serverId, generation: servers[0].generation };
  const host = join(fleet.root, "host.json");
  await writeFile(
    host,
    JSON.stringify({ baseUrl: options.baseUrl, ownerToken: options.ownerToken, scope }),
    { mode: 0o600 },
  );
  browser = own(
    spawn(node, [entry, host], { cwd: fleet.root, env, stdio: ["pipe", "pipe", "pipe"] }),
  );
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  browser.stdout.on("data", (bytes) => {
    try {
      buffer += decoder.write(bytes);
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        assert.ok(Buffer.byteLength(buffer.slice(0, end)) <= 8 * 1024 * 1024 && ++count <= 5000);
        const value = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        assert.equal(value.version, 1);
        assert.ok(Number.isSafeInteger(value.sequence) && value.sequence > sequence);
        sequence = value.sequence;
        latest = value;
        if (trace.length === 128) trace.shift();
        trace.push({
          phase,
          sequence,
          request: value.request,
          presenceRevision: value.presenceRevision,
          catalogComplete: value.sessionCatalogComplete === true,
          preferred: value.preferredPane != null,
          frame: !!value.snapshot,
          input: value.inputReady === true,
        });
      }
      assert.ok(Buffer.byteLength(buffer) <= 8 * 1024 * 1024);
    } catch {
      fatal ??= "invalid-publication";
    }
  });
  browser.stdout.on("end", () => {
    buffer += decoder.end();
    if (!closing || buffer) fatal ??= "unexpected-publication-eof";
  });
  phase = "home";
  await until(() => latest?.home?.phase === "live" && latest.sessions?.length === 1);
  const session = latest.sessions[0].id;
  send({ type: "presence", active: false, revision: 1 });
  await until(() => latest.presenceRevision === 1);
  phase = "background-catalog";
  send({ type: "session", request: 1, id: session });
  await until(
    () =>
      latest.request === 1 &&
      latest.sessionCatalogComplete &&
      latest.selectedSession === session &&
      latest.panes?.length === 1,
  );
  assert.equal(latest.preferredPane, null);
  assert.equal(latest.snapshot, null);
  assert.equal(latest.selectedPane, null);
  assert.equal(latest.inputReady, false);
  const pane = latest.panes[0].id;
  phase = "helper-retirement";
  await until(
    async () =>
      helpers().length === 0 &&
      !(await readdir(privateTmp)).some((name) => name.startsWith("tmux-gpui-pane-")),
  );
  retirementProved = true;
  triggerSequence = latest.sequence;
  phase = "late-presence-ack";
  send({ type: "presence", active: true, revision: 2 });
  send({ type: "appearance", system: "dark" });
  await until(
    () =>
      latest.sequence > triggerSequence &&
      latest.presenceRevision === 2 &&
      latest.preferredPane === pane,
    2000,
  );
  assert.equal(latest.request, 1);
  assert.equal(latest.selectedSession, session);
  assert.equal(latest.selectedPane, null);
  assert.equal(latest.snapshot, null);
  assert.equal(latest.inputReady, false);
} catch {
  errors.push(fatal ?? `${phase}-failed`);
} finally {
  // Check source preservation even when the expected baseline ACK assertion fails.
  if (before)
    try {
      assert.deepEqual(source(), before);
      sourcePreserved = true;
    } catch {
      errors.push("source-identity-check-failed");
    }
  closing = true;
  let safe = true;
  try {
    await stopFixtureChild(browser);
  } catch {
    safe = false;
    errors.push("browser-cleanup-failed");
  }
  try {
    await stopHelpers();
  } catch {
    safe = false;
    errors.push("helper-cleanup-failed");
  }
  try {
    await stopFixtureChild(daemon);
  } catch {
    safe = false;
    errors.push("daemon-cleanup-failed");
  }
  if (fleet)
    try {
      tmux("kill-server");
      if (safe) {
        await rm(fleet.root, { recursive: true, force: true });
        cleaned = true;
      }
    } catch {
      errors.push("socket-cleanup-failed");
    }
}
if (fatal && !errors.includes(fatal)) errors.push(fatal);
try {
  writeFileSync(
    receipt,
    JSON.stringify(
      {
        passed: errors.length === 0,
        artifacts,
        retirementProved,
        triggerSequence,
        sourceBirthsPreserved: sourcePreserved,
        ownedCleanup: cleaned,
        observedHelperCount: helperPids.size,
        publications: count,
        stderrBytes,
        paneCommands: 0,
        inputCommands: 0,
        trace,
        errors,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
} finally {
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}
console.log(
  JSON.stringify({
    passed: errors.length === 0,
    retirementProved,
    sourceBirthsPreserved: sourcePreserved,
    ownedCleanup: cleaned,
    errors,
  }),
);
assert.deepEqual(errors, []);
