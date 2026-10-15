// Real isolated browser/daemon admission check. Requires an explicit prebuilt CLI;
// does not rebuild generated bin/cli.js, open a GUI, or touch personal sessions.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { createScratchFleet } from "../../../scripts/lib/product-fixtures/scratch-fleet.ts";
import { stopFixtureChild } from "./fixture-child.mjs";
const cli = process.env.TMUX_GPUI_TEST_CLI;
assert.ok(cli && isAbsolute(cli), "Provide absolute TMUX_GPUI_TEST_CLI");
for (const key of Object.keys(process.env))
  if (
    key.startsWith("TMUX_IDE_") ||
    ["TMUX", "TMUX_PANE", "TMUX_TMPDIR", "NODE_OPTIONS", "NODE_PATH"].includes(key)
  )
    delete process.env[key];

const results = [];
for (const mode of ["home", "attention"]) {
  const fleet = await createScratchFleet({
    sessions: 1,
    windowsPerSession: 1,
    slug: `agent-admit-${mode}`,
  });
  const env = { ...process.env, ...fleet.environment };
  const tmux = (...args) =>
    execFileSync(env.TMUX_IDE_TMUX_BIN, ["-S", fleet.socketPath, ...args], {
      env,
      encoding: "utf8",
      timeout: 5000,
    }).trim();
  let daemon,
    browser,
    latest,
    fatal,
    buffer = "",
    diagnostics = 0,
    lastState = "";
  const failures = [];
  const until = async (predicate) => {
    const deadline = Date.now() + 30000;
    for (;;) {
      if (fatal) throw fatal;
      if (await predicate()) {
        if (fatal) throw fatal;
        return;
      }
      assert.ok(
        Date.now() < deadline,
        `Private ${mode} admission deadline: ${JSON.stringify({
          request: latest?.request,
          status: latest?.status,
          selectedPane: latest?.selectedPane,
          inputReady: latest?.inputReady,
          connection: latest?.connection,
        })}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  try {
    const original = fleet.initialPanes[0].paneId;
    const second = tmux(
      "split-window",
      "-h",
      "-t",
      original,
      "-P",
      "-F",
      "#{pane_id}",
      "exec sleep 180",
    );
    for (const [pane, state] of [
      [original, "working"],
      [second, "blocked"],
    ]) {
      tmux("set-option", "-p", "-t", pane, "@agent_display_name", "Duplicate agent");
      tmux(
        "set-option",
        "-p",
        "-t",
        pane,
        "@agent_state",
        `${state}:${Math.floor(Date.now() / 1000)}`,
      );
      assert.equal(tmux("display-message", "-p", "-t", pane, "#{@tmux_ide_pane_id}"), "");
    }
    daemon = spawn(process.execPath, [cli, "--headless"], {
      env,
      stdio: ["ignore", "ignore", "ignore"],
    });
    daemon.on("error", (e) => {
      fatal ??= e;
    });
    await until(async () => {
      try {
        return (
          JSON.parse(await readFile(fleet.daemonInfoDir + "/daemon.json", "utf8")).pid ===
          daemon.pid
        );
      } catch {
        return false;
      }
    });
    browser = spawn(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        resolve("apps/tmux-gpui/bridge/browser.ts"),
        "--local",
      ],
      { env, stdio: ["pipe", "pipe", "pipe"] },
    );
    browser.on("error", (e) => {
      fatal ??= e;
    });
    browser.stdin.on("error", (e) => {
      fatal ??= e;
    });
    browser.stderr.on("data", (data) => {
      diagnostics += data.length;
      if (diagnostics > 65536) fatal ??= new Error("Diagnostics overflow");
    });
    browser.stdout.on("data", (data) => {
      try {
        buffer += data;
        assert.ok(Buffer.byteLength(buffer) <= 8 * 1024 * 1024, "Publication overflow");
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
          latest = JSON.parse(buffer.slice(0, end));
          const state = JSON.stringify({
            request: latest.request,
            status: latest.status,
            selectedPane: latest.selectedPane,
            inputReady: latest.inputReady,
            connection: latest.connection,
          });
          if (state !== lastState)
            console.log(JSON.stringify({ stage: "state", mode, state: JSON.parse(state) }));
          lastState = state;
          buffer = buffer.slice(end + 1);
        }
      } catch (error) {
        fatal ??= error;
      }
    });
    const send = (value) => browser.stdin.write(JSON.stringify(value) + "\n");
    await until(() => latest?.homeAgents?.phase === "live" && latest.homeAgents.rows.length === 2);
    send({ type: "presence", active: true, revision: 1 });
    await until(
      () =>
        latest?.presenceRevision === 1 &&
        latest?.homeAgents?.phase === "live" &&
        latest.homeAgents.rows.length === 2,
    );
    if (mode === "attention")
      send({ type: "attention-observe", request: 0, scope: 1, active: true });
    await until(() => {
      const roster = mode === "home" ? latest?.homeAgents : latest?.attentionAgents;
      return roster?.phase === "live" && roster.rows.some((row) => row.attention);
    });
    const roster = mode === "home" ? latest.homeAgents : latest.attentionAgents;
    const candidates = roster.rows.filter((row) => row.attention);
    assert.equal(candidates.length, 1);
    const target = candidates[0];
    console.log(JSON.stringify({ stage: "observed-unopened", mode, rows: roster.rows }));
    assert.equal(target.available, true, "Observed agent must offer targeted admission");
    assert.equal(target.status, "BLOCKED");
    assert.equal(latest.request, 0);
    assert.equal(latest.selectedPane, null);
    assert.equal(latest.inputReady, false);
    assert.equal(
      tmux("display-message", "-p", "-t", second, "#{@tmux_ide_pane_id}"),
      "",
      "Observation must not promote",
    );
    send({
      type: mode === "home" ? "open-agent" : "open-attention-agent",
      request: 1,
      fromRequest: 0,
      rosterRevision: roster.revision,
      key: target.key,
      ...(mode === "attention" ? { scope: 1 } : {}),
    });
    await until(
      () => latest?.request === 1 && latest.inputReady && latest.snapshot && latest.selectedPane,
    );
    const secondStamp = tmux("display-message", "-p", "-t", second, "#{@tmux_ide_pane_id}");
    const firstStamp = tmux("display-message", "-p", "-t", original, "#{@tmux_ide_pane_id}");
    assert.ok(secondStamp && firstStamp && secondStamp !== firstStamp);
    assert.equal(latest.selectedPane, secondStamp);
    assert.notEqual(latest.selectedPane, firstStamp);
    assert.equal(
      tmux("list-panes", "-t", fleet.sessionNames[0], "-F", "#{pane_id}").split("\n").length,
      2,
    );
    results.push({
      mode,
      unopened: true,
      duplicateLabels: true,
      exactBlockedSecondPane: true,
      inputReady: true,
    });
  } catch (error) {
    failures.push(error);
  } finally {
    for (const cleanup of [
      () => browser && stopFixtureChild(browser),
      () => daemon && stopFixtureChild(daemon),
      () => fleet.dispose(),
    ]) {
      try {
        await cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (fatal && !failures.includes(fatal)) failures.push(fatal);
  if (failures.length) throw new AggregateError(failures, `Agent admission ${mode} fixture failed`);
}
console.log(JSON.stringify({ passed: true, results, ownedCleanup: true, nativeUi: false }));
