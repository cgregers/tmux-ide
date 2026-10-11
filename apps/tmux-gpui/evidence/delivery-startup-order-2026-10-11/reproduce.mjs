import { createScratchFleet } from "../../../../scripts/lib/product-fixtures/scratch-fleet.ts";
import { stopFixtureChild } from "../../bridge/fixture-child.mjs";
import { spawn, execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
for (const k of Object.keys(process.env))
  if (
    k.startsWith("TMUX_IDE_") ||
    ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(k)
  )
    delete process.env[k];
// Put the qualified bundled tmux directory on PATH before invoking this fixture.
const mode = process.argv[2];
const name = mode.startsWith("long")
  ? "Long session label for narrow sidebar verification"
  : "Terminal lab";
const fleet = await createScratchFleet({
  sessions: 1,
  windowsPerSession: 1,
  slug: "gpui-input-triage",
});
const env = { ...process.env, ...fleet.environment };
const run = (...a) =>
  execFileSync(env.TMUX_IDE_TMUX_BIN, ["-S", fleet.socketPath, ...a], {
    env,
    encoding: "utf8",
  }).trim();
let daemon, helper, latest, fatal;
let buffer = "";
const transitions = [];
let previous;
const errors = [];
const checks = [];
const wait = async (fn) => {
  const until = Date.now() + 20000;
  while (true) {
    if (fatal) throw fatal;
    if (await fn()) return;
    if (Date.now() > until) throw Error("timeout");
    await new Promise((r) => setTimeout(r, 40));
  }
};
try {
  run("rename-session", "-t", fleet.sessionNames[0], name);
  const first = run("list-panes", "-t", name, "-F", "#{pane_id}");
  run("respawn-pane", "-k", "-t", first, "/bin/zsh -f");
  run("split-window", mode.endsWith("vertical") ? "-v" : "-h", "-t", first, "/bin/zsh -f");
  if (mode.includes("output")) {
    const command = String.raw`clear; printf '\033[1;36mTMUX IDE • NATIVE PLAYGROUND\033[0m\n\nReal tmux panes. Drag the divider and type here.\nHome: F1 | Commands: F5 | Sessions: F6\n\n'; for i in {1..60}; do printf 'Scrollback line %02d — hello from tmux\n' "$i"; done`;
    for (const pane of run("list-panes", "-t", name, "-F", "#{pane_id}").split("\n")) {
      run("send-keys", "-t", pane, "-l", command);
      run("send-keys", "-t", pane, "Enter");
    }
  }
  daemon = spawn(
    process.execPath,
    [
      process.env.GPUI_TRIAGE_CLI || ".tasks/gpui-fleet-input-triage/baseline/cli.mjs",
      "--headless",
    ],
    { env, stdio: ["ignore", "ignore", "ignore"] },
  );
  daemon.on("error", (e) => {
    fatal = e;
  });
  await wait(async () => {
    try {
      return (
        JSON.parse(await readFile(fleet.daemonInfoDir + "/daemon.json", "utf8")).pid === daemon.pid
      );
    } catch {
      return false;
    }
  });
  helper = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      process.env.GPUI_TRIAGE_BRIDGE || "apps/tmux-gpui/bridge/browser.ts",
      "--local",
    ],
    { env, stdio: ["pipe", "pipe", "pipe"] },
  );
  helper.on("error", (e) => {
    fatal = e;
  });
  helper.stdin.on("error", (e) => {
    fatal = e;
  });
  helper.stderr.on("data", (b) => {
    const text = b.toString();
    if (text.includes("Preview stream validation failed")) errors.push("replica-validation");
    if (text.includes("Live preview could not connect")) errors.push("live-connect");
    if (text.includes("BROWSER_PARSE:")) errors.push("browser-parse");
    for (const l of text.trim().split("\n")) if (l.startsWith("EVENT_META:")) errors.push(l);
    if (text.includes("CHUNK_META:"))
      errors.push(
        text
          .trim()
          .split("\n")
          .find((s) => s.startsWith("CHUNK_META:")),
      );
    if (text.includes("REPLICA_CATEGORY:"))
      errors.push(
        text
          .trim()
          .split("\n")
          .find((s) => s.startsWith("REPLICA_CATEGORY:")),
      );
  });
  helper.stdout.on("data", (b) => {
    try {
      buffer += b;
      if (buffer.length > 8 * 1024 * 1024) throw Error("oversize");
      let i;
      while ((i = buffer.indexOf("\n")) >= 0) {
        latest = JSON.parse(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
        const t = {
          request: latest.request,
          status: latest.status,
          ready: latest.inputReady,
          frame: !!latest.snapshot,
          layouts: latest.layouts?.length,
        };
        const key = JSON.stringify(t);
        if (key !== previous) {
          transitions.push(t);
          previous = key;
        }
      }
    } catch (e) {
      fatal = e;
    }
  });
  const send = (x) => helper.stdin.write(JSON.stringify(x) + "\n");
  await wait(() => latest?.fleet?.groups.some((g) => g.sessions.some((s) => s.selection)));
  const row = latest.fleet.groups.flatMap((g) => g.sessions).find((s) => s.selection);
  send({ type: "fleet-session", request: 1, selection: row.selection });
  await wait(() => latest?.request === 1 && latest.preferredPane);
  send({ type: "pane", request: 2, id: latest.preferredPane });
  await wait(() => latest?.request === 2 && latest.inputReady);
  checks.push("initial-input-ready");
  if (process.env.GPUI_TRIAGE_EXTENDED === "1") {
    const pane = latest.selectedPane;
    const marker = "GPUI_ORDERED_INPUT_OK";
    send({
      type: "input",
      request: 2,
      id: pane,
      input: { kind: "text", data: "printf 'GPUI_ORDERED_INPUT_OK\\n'" },
    });
    send({ type: "input", request: 2, id: pane, input: { kind: "key", data: "Enter" } });
    await wait(() =>
      latest?.snapshot?.grid.some(
        (r) =>
          r.cells
            .map((c) => c.grapheme)
            .join("")
            .trim() === marker,
      ),
    );
    const captures = run("list-panes", "-t", name, "-F", "#{pane_id}")
      .split("\n")
      .map((id) => run("capture-pane", "-p", "-t", id));
    if (captures.filter((c) => c.split("\n").some((l) => l.trim() === marker)).length !== 1)
      throw Error("input-routing");
    checks.push("exact-input-one-pane-only");
    send({ type: "home", request: 3 });
    await wait(
      () =>
        latest?.request === 3 &&
        latest?.surface === "home" &&
        latest?.fleet?.groups.some((g) => g.sessions.some((s) => s.selection)),
    );
    const next = latest.fleet.groups.flatMap((g) => g.sessions).find((s) => s.selection);
    send({ type: "fleet-session", request: 4, selection: next.selection });
    await wait(() => latest?.request === 4 && latest.preferredPane);
    send({ type: "pane", request: 5, id: latest.preferredPane });
    await wait(() => latest?.request === 5 && latest.inputReady);
    checks.push("home-reopen-input-ready");
  }
} catch (e) {
  errors.push(e.message === "timeout" ? "timeout" : "fixture-error");
} finally {
  for (const stop of [
    () => stopFixtureChild(helper),
    () => stopFixtureChild(daemon),
    () => fleet.dispose(),
  ])
    try {
      await stop();
    } catch {
      errors.push("cleanup-error");
    }
}
const result = { mode, checks, errors, transitions };
if (process.env.GPUI_TRIAGE_RESULT)
  await writeFile(process.env.GPUI_TRIAGE_RESULT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));

if (
  !checks.includes("initial-input-ready") ||
  errors.some((e) =>
    ["timeout", "fixture-error", "cleanup-error", "replica-validation", "browser-parse"].includes(
      e,
    ),
  )
)
  process.exitCode = 1;
