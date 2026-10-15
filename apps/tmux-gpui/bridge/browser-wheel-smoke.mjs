// Isolated browser wheel-to-PTY journey; no GUI or CLI build.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { StringDecoder } from "node:string_decoder";
import console from "node:console";
import { setTimeout } from "node:timers";
import { execFileSync, spawn } from "node:child_process";
import { access, stat, writeFile, readFile, rm } from "node:fs/promises";
import { constants, readFileSync } from "node:fs";
import { resolve, join, isAbsolute } from "node:path";
import { createScratchFleet } from "../../../scripts/lib/product-fixtures/scratch-fleet.ts";

import { listTmuxServers } from "../../../packages/daemon-client/src/tmux-server-client.ts";
import { stopFixtureChild } from "./fixture-child.mjs";
const cli = process.env.TMUX_GPUI_TEST_CLI;
assert.ok(cli && isAbsolute(cli), "Explicit private TMUX_GPUI_TEST_CLI required");
assert.ok((await stat(cli)).isFile(), "Private CLI must be a regular file");
await access(cli, constants.R_OK);
const app = process.env.TMUX_GPUI_TEST_APP;
if (app !== undefined) {
  assert.ok(isAbsolute(app), "TMUX_GPUI_TEST_APP must be absolute");
  assert.ok((await stat(app)).isDirectory());
  for (const file of ["node", "bridge/browser.bundle.mjs"]) {
    const path = join(app, "Contents/Resources", file);
    assert.ok((await stat(path)).isFile());
    await access(path, file === "node" ? constants.X_OK : constants.R_OK);
  }
}
for (const key of Object.keys(process.env)) {
  if (
    key.startsWith("TMUX_IDE_") ||
    key.startsWith("CLAUDE") ||
    key.startsWith("CODEX") ||
    key.startsWith("ANTHROPIC") ||
    key.startsWith("OPENAI") ||
    ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(key)
  )
    delete process.env[key];
}
const fleet = await createScratchFleet({
  sessions: 1,
  windowsPerSession: 1,
  slug: "gpui-browser-wheel",
});
const fixtureEnvironment = { ...fleet.environment };
const run = (...args) =>
  execFileSync(fleet.environment.TMUX_IDE_TMUX_BIN, ["-S", fleet.socketPath, ...args], {
    env: { ...process.env, ...fixtureEnvironment },
    encoding: "utf8",
    timeout: 5000,
  }).trim();
let daemon, browser, latest, fatal, result, before;
let phase = "setup",
  sourceIdentityPreserved = false;
let legacyScrollConsumedLocally = false;
const received = join(fleet.root, "wheel-bytes");
const receivedBytes = () => {
  try {
    const bytes = readFileSync(received);
    assert.ok(bytes.length <= 65536, "PTY fixture output bound");
    return bytes;
  } catch (error) {
    if (error.code === "ENOENT") return Buffer.alloc(0);
    throw error;
  }
};
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
const decoder = new StringDecoder("utf8");
let buffer = "",
  stderr = "";
const failures = [];
const cancelled = () => {
  fatal ??= new Error("Fixture cancelled");
};
process.on("SIGINT", cancelled);
process.on("SIGTERM", cancelled);
let cleanupPassed = true,
  receivedBytesFinal;
async function until(predicate) {
  const deadline = Date.now() + 25000;
  for (;;) {
    if (fatal) throw fatal;
    if (predicate()) {
      if (fatal) throw fatal;
      return;
    }
    if (browser && (browser.exitCode !== null || browser.signalCode !== null))
      throw new Error("Browser exited");
    assert.ok(
      Date.now() < deadline,
      `Browser-wheel deadline: ${JSON.stringify({ phase, presence: latest?.presenceRevision, hasSnapshot: !!latest?.snapshot, inputReady: latest?.inputReady, historyOffset: latest?.historyOffset, receivedByteCount: receivedBytes().length })}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
try {
  const nativePane = fleet.initialPanes[0].paneId;
  const python = execFileSync("/usr/bin/which", ["python3"], { encoding: "utf8" }).trim();
  assert.ok(isAbsolute(python));
  const program = join(fleet.root, "wheel-fixture.py");
  await writeFile(
    program,
    `import os, sys, tty, time, select
tty.setraw(0)
os.write(1, b"\\x1b[?1049h\\x1b[?1000h\\x1b[?1006hWHEEL_READY")
end = time.monotonic() + 120
with open(sys.argv[1], "ab", buffering=0) as f:
 while time.monotonic() < end:
  if select.select([0], [], [], 0.25)[0]:
   data = os.read(0, 4096)
   if not data: break
   f.write(data)
`,
    { mode: 0o600 },
  );
  run(
    "send-keys",
    "-t",
    nativePane,
    "-l",
    `exec ${quote(python)} ${quote(program)} ${quote(received)}`,
  );
  run("send-keys", "-t", nativePane, "Enter");
  daemon = spawn(process.execPath, [cli, "--headless"], {
    env: { ...process.env, ...fixtureEnvironment },
    stdio: "ignore",
  });
  daemon.on("error", (error) => {
    fatal ??= error;
  });
  let record;
  const deadline = Date.now() + 25000;
  while (!record) {
    if (fatal) throw fatal;
    assert.ok(Date.now() < deadline, "Daemon startup deadline");
    try {
      const value = JSON.parse(await readFile(fleet.daemonInfoDir + "/daemon.json", "utf8"));
      if (value.pid === daemon.pid) record = value;
    } catch {
      // Wait for the owned daemon atomic discovery record.
    }
    if (!record) await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const options = {
    baseUrl: `http://127.0.0.1:${record.port}/`,
    ownerToken: record.authToken,
    hostClientId: "gpui-browser-wheel",
    origin: "tmux-ide://app",
  };
  const server = (await listTmuxServers(options)).servers.find((s) => s.state === "online");
  assert.ok(server);
  const config = fleet.root + "/host.json";
  await writeFile(
    config,
    JSON.stringify({
      baseUrl: options.baseUrl,
      ownerToken: options.ownerToken,
      scope: { serverId: server.serverId, generation: server.generation },
    }),
    { mode: 0o600 },
  );
  browser = spawn(
    app ? join(app, "Contents/Resources/node") : process.execPath,
    app
      ? [join(app, "Contents/Resources/bridge/browser.bundle.mjs"), config]
      : ["--import", "tsx", resolve("apps/tmux-gpui/bridge/browser.ts"), config],
    {
      env: { ...process.env, ...fixtureEnvironment, ...(app ? { PATH: "/usr/bin:/bin" } : {}) },
      ...(app ? { cwd: fleet.root } : {}),
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  browser.on("error", (error) => {
    fatal ??= error;
  });
  browser.stdin.on("error", (error) => {
    fatal ??= error;
  });
  browser.stdout.on("error", (error) => {
    fatal ??= error;
  });
  browser.stderr.on("error", (error) => {
    fatal ??= error;
  });
  browser.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-4096);
  });
  browser.stdout.on("data", (chunk) => {
    try {
      buffer += decoder.write(chunk);
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        assert.ok(end <= 8 * 1024 * 1024);
        latest = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
      assert.ok(buffer.length <= 8 * 1024 * 1024);
    } catch (error) {
      fatal ??= error;
    }
  });
  const send = (command) => browser.stdin.write(JSON.stringify(command) + "\n");
  await until(() => latest?.sessions.length === 1);
  const session = latest.sessions[0].id;
  assert.equal(latest.sessions[0].paneCount, 1);
  send({ type: "presence", active: true, revision: 1 });
  send({ type: "session", request: 1, id: session });
  await until(() => latest?.request === 1 && latest.sessionCatalogComplete);
  const original = latest.preferredPane;
  assert.ok(original);
  send({ type: "pane", request: 2, id: original });
  await until(() => latest?.inputReady && latest.paneActions);
  before = run("list-panes", "-a", "-F", "#{pane_id}|#{pane_pid}|#{pane_birth_id}");
  const text = () =>
    latest.snapshot?.grid
      .map((row) => row.cells.map((cell) => cell.grapheme).join(""))
      .join("\n") ?? "";
  await until(() => latest?.request === 2 && latest.inputReady && text().includes("WHEEL_READY"));
  assert.equal(latest.historyOffset, 0);
  assert.equal(receivedBytes().length, 0);
  phase = "legacy-scroll";
  send({ type: "input", request: 2, id: original, input: { kind: "scroll", data: 3 } });
  // Alternate-screen legacy scroll is ignored locally (no scrollback), never PTY mouse input.
  send({ type: "presence", active: true, revision: 2 });
  await until(() => latest?.presenceRevision === 2);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(latest.historyOffset, 0);
  assert.equal(receivedBytes().length, 0, "legacy scroll must not send application mouse reports");
  legacyScrollConsumedLocally = true;
  send({ type: "input", request: 2, id: original, input: { kind: "scroll", data: 0 } });
  await until(() => latest?.historyOffset === 0 && latest.inputReady);
  phase = "application-wheel";
  send({
    type: "input",
    request: 2,
    id: original,
    input: {
      kind: "wheel",
      data: {
        lines: 3,
        row: 2,
        col: 4,
        shift: false,
        alt: false,
        control: false,
      },
    },
  });
  const expected = Buffer.from("\x1b[<64;5;3M".repeat(3));
  await until(() => receivedBytes().length >= expected.length);
  assert.deepEqual(
    receivedBytes(),
    expected,
    "exact three SGR wheel-up reports at one-based col5/row3",
  );
  assert.equal(latest.historyOffset, 0);
  assert.equal(latest.inputReady, true);
  const wheel = (lines, shift = false, request = 2) =>
    send({
      type: "input",
      request,
      id: original,
      input: { kind: "wheel", data: { lines, row: 2, col: 4, shift, alt: false, control: false } },
    });
  phase = "reverse-wheel";
  wheel(-2);
  const bothDirections = Buffer.concat([expected, Buffer.from("\x1b[<65;5;3M".repeat(2))]);
  await until(() => receivedBytes().length >= bothDirections.length);
  assert.deepEqual(receivedBytes(), bothDirections);
  phase = "shift-local";
  wheel(3, true);
  send({ type: "presence", active: true, revision: 3 });
  await until(() => latest?.presenceRevision === 3);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.deepEqual(receivedBytes(), bothDirections, "Shift wheel never reaches application");
  assert.equal(latest.historyOffset, 0, "alternate screen has no local scrollback");
  phase = "stale-request";
  wheel(3, false, 1);
  send({ type: "presence", active: true, revision: 4 });
  await until(() => latest?.presenceRevision === 4);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.deepEqual(
    receivedBytes(),
    bothDirections,
    "stale request wheel never reaches application",
  );
  assert.equal(latest.request, 2);
  assert.equal(latest.inputReady, true);
  result = {
    exactSgrUpReports: 3,
    exactSgrDownReports: 2,
    column: 5,
    row: 3,
    shiftStaysLocal: true,
    staleRequestRefused: true,
    inputReady: true,
  };
} catch (error) {
  failures.push(error);
} finally {
  try {
    sourceIdentityPreserved =
      !!before &&
      run("list-panes", "-a", "-F", "#{pane_id}|#{pane_pid}|#{pane_birth_id}") === before;
    assert.ok(sourceIdentityPreserved, "source identity changed or no baseline captured");
  } catch (error) {
    failures.push(error);
  }
  try {
    receivedBytesFinal = receivedBytes().length;
  } catch (error) {
    failures.push(error);
  }
  for (const cleanup of [
    () => stopFixtureChild(browser),
    () => daemon && stopFixtureChild(daemon),
    async () => {
      run("kill-server");
      assert.throws(
        () => run("-N", "list-sessions"),
        (error) =>
          error.status === 1 && /no server running|error connecting/.test(String(error.stderr)),
        "owned server must be stopped (tmux may retain its socket file)",
      );
      if (cleanupPassed) await rm(fleet.root, { recursive: true, force: true });
    },
  ]) {
    try {
      await cleanup();
    } catch (error) {
      cleanupPassed = false;
      failures.push(error);
    }
  }
}
process.off("SIGINT", cancelled);
process.off("SIGTERM", cancelled);
if (fatal) failures.push(fatal);
console.log(
  JSON.stringify({
    passed: failures.length === 0,
    phase,
    legacyScrollConsumedLocally,
    ...result,
    sourceIdentityPreserved,
    packaged: !!app,
    receivedByteCount: receivedBytesFinal,
    cleanup: cleanupPassed,
    failures: failures.map((error) => error.message.slice(0, 240)),
  }),
);
if (failures.length) process.exitCode = 1;
