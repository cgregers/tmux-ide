import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { setTimeout, clearTimeout } from "node:timers";
import { createOracle, observeChild, parseOptions } from "./browser-lifecycle-probe.mjs";

const options = { duration: 1, realHost: false };
const catalog = { request: 0, sessions: [{ id: "session" }], panes: [] };
const panes = {
  ...catalog,
  request: 1,
  selectedSession: "session",
  sessionCatalogComplete: true,
  panes: [{ id: "pane" }],
};
const ready = {
  ...panes,
  request: 2,
  selectedPane: "pane",
  surface: "workspace",
  presenceRevision: 1,
  inputReady: false,
  snapshot: { cells: "PRIVATE" },
};
test("real host requires opt-in and all exact IDs; isolated mode requires private CLI", () => {
  assert.equal(
    parseOptions(["--app", "/app", "--cli", "/cli", "--duration-seconds", "1"]).realHost,
    false,
  );
  assert.throws(() => parseOptions(["--app", "/app", "--duration-seconds", "1"]));
  assert.throws(() => parseOptions(["--app", "/app", "--real-host", "--duration-seconds", "1"]));
  assert.throws(() => parseOptions(["--app", "/app", "--cli", "/cli", "--duration-seconds", "0"]));
  const real = parseOptions([
    "--app",
    "/app",
    "--real-host",
    "--duration-seconds",
    "5",
    "--machine-id",
    "m",
    "--session-id",
    "s",
    "--pane-id",
    "p",
  ]);
  assert.equal(real.paneId, "p");
});
test("oracle requires sustained read-only snapshot and refuses any later loss", () => {
  let now = 0;
  const oracle = createOracle(options, () => now);
  assert.deepEqual(oracle.commands.splice(0), [{ type: "presence", active: false, revision: 1 }]);
  oracle.observe(catalog);
  oracle.observe(panes);
  oracle.observe(ready);
  assert.deepEqual(
    oracle.commands.map((c) => c.type),
    ["session", "pane"],
  );
  now = 999;
  assert.equal(oracle.complete(), false);
  now = 1000;
  assert.equal(oracle.complete(), true);
  assert.doesNotMatch(JSON.stringify(oracle.summary()), /PRIVATE|session|pane/);
  assert.throws(() => oracle.observe({ ...ready, snapshot: null }), /readiness-lost/);
  for (const changed of [
    { inputReady: true },
    { selectedPane: "other" },
    { request: 3 },
    { presenceRevision: 2 },
  ]) {
    const current = createOracle(options);
    current.observe(catalog);
    current.observe(panes);
    current.observe(ready);
    assert.throws(() => current.observe({ ...ready, ...changed }), /readiness-lost/);
  }
});
test("real selection uses exact published route and explicit pane, never labels or first group", () => {
  const oracle = createOracle({
    ...options,
    realHost: true,
    machineId: "m2",
    sessionId: "fleet-row",
    paneId: "pane",
  });
  oracle.commands.splice(0);
  oracle.observe({
    ...catalog,
    fleet: {
      groups: [
        { id: "m1", sessions: [{ id: "fleet-row", sessionId: "other-live", selection: "wrong" }] },
        { id: "m2", sessions: [{ id: "fleet-row", sessionId: "session", selection: "exact" }] },
      ],
    },
  });
  assert.deepEqual(oracle.commands.splice(0), [
    { type: "fleet-session", request: 1, selection: "exact" },
  ]);
  oracle.observe({ ...panes, preferredPane: null, panes: [{ id: "other" }, { id: "pane" }] });
  assert.deepEqual(oracle.commands.splice(0), [{ type: "pane", request: 2, id: "pane" }]);
  oracle.observe(ready);
  assert.equal(oracle.summary().stage, "stable");
});
function fixtureCode(loss = false) {
  return `let buffer='';process.stdin.on('data',chunk=>{buffer+=chunk;let n;while((n=buffer.indexOf('\\n'))>=0){const c=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);if(c.type==='presence')emit(${JSON.stringify(catalog)});else if(c.type==='session')emit(${JSON.stringify(panes)});else if(c.type==='pane'){emit(${JSON.stringify(ready)});${loss ? `setTimeout(()=>emit(${JSON.stringify({ ...ready, snapshot: null })}),50);` : ""}}else process.exit(9);}});function emit(v){process.stdout.write(JSON.stringify(v)+'\\n')}setInterval(()=>{},1000);`;
}

test("fleet identity mapping must exist and cannot accept a different live session", () => {
  for (const sessionId of [null, "live-session"]) {
    const oracle = createOracle({
      ...options,
      realHost: true,
      machineId: "m",
      sessionId: "fleet-row",
      paneId: "pane",
    });
    oracle.commands.splice(0);
    const event = {
      ...catalog,
      fleet: {
        groups: [{ id: "m", sessions: [{ id: "fleet-row", sessionId, selection: "route" }] }],
      },
    };
    if (sessionId === null) {
      assert.throws(() => oracle.observe(event), /live-session-unavailable/);
      assert.deepEqual(oracle.commands, []);
    } else {
      oracle.observe(event);
      oracle.commands.splice(0);
      assert.throws(() => oracle.observe(panes), /session-mismatch/);
      assert.deepEqual(oracle.commands, []);
    }
  }
});
test("real child steady observation passes only after interval and retires owned child", async () => {
  const result = await observeChild({
    executable: process.execPath,
    env: {},
    args: ["-e", fixtureCode()],
    options,
    startupMs: 1000,
  });
  assert.equal(result.passed, true);
  assert.ok(result.stableMs >= 1000);
});
test("real child initial success followed by missing frame fails, and abort is bounded", async () => {
  await assert.rejects(
    observeChild({
      executable: process.execPath,
      env: {},
      args: ["-e", fixtureCode(true)],
      options,
      startupMs: 1000,
    }),
    /readiness-lost/,
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50);
  try {
    await assert.rejects(
      observeChild({
        executable: process.execPath,
        env: {},
        args: ["-e", "setInterval(()=>{},1000)"],
        options,
        signal: controller.signal,
      }),
      /probe-cancelled/,
    );
  } finally {
    clearTimeout(timer);
  }
});

test("stdout EOF cannot masquerade as a quiet stable browser", async () => {
  await assert.rejects(
    observeChild({
      executable: process.execPath,
      env: {},
      args: ["-e", "process.stdout.end();setInterval(()=>{},1000)"],
      options,
      startupMs: 1000,
    }),
    /browser-output-ended/,
  );
});
