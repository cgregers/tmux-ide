import { test } from "node:test";
import assert from "node:assert/strict";
import { createDiagnosticChannel } from "./diagnostic-channel.ts";

test("fragmented diagnostics survive noisy stderr and retain the first failure", () => {
  const received: unknown[] = [];
  const reader = createDiagnosticChannel((fault) => received.push(fault));
  reader.push(Buffer.from("PRIVATE_TOKEN\n" + "x".repeat(10000)));
  reader.push(Buffer.from('\nTMUX_GPUI_DIAGNOSTIC {"code":"publication-'));
  reader.push(Buffer.from('limit"}\nTMUX_GPUI_DIAGNOSTIC {"code":"startup"}\n'));
  assert.deepEqual(received, [{ code: "publication-limit" }]);
  assert.deepEqual(reader.fault, { code: "publication-limit" });
});

test("untrusted diagnostics do not expose arbitrary text or poison the next line", () => {
  const received: unknown[] = [];
  const reader = createDiagnosticChannel((fault) => received.push(fault));
  reader.push(Buffer.from('TMUX_GPUI_DIAGNOSTIC {"code":"startup","secret":"PRIVATE"}\n'));
  reader.push(Buffer.from('TMUX_GPUI_DIAGNOSTIC {"code":"transport-closed","closeCode":1006}\n'));
  assert.deepEqual(received, [{ code: "transport-closed", closeCode: 1006 }]);
});

test("fatal stderr followed by buffered stdout cannot readmit a ready presentation", async () => {
  const { spawn } = await import("node:child_process");
  const { once } = await import("node:events");
  const child = spawn(
    process.execPath,
    [
      "-e",
      `
    process.stderr.write('TMUX_GPUI_DIAGNOSTIC {"code":"publication-limit"}\\n');
    process.stdin.once('data', () => process.stdout.end('{"inputReady":true}\\n'));
  `,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let ready = true;
  let receivedPublication = false;
  const reader = createDiagnosticChannel(() => {
    ready = false;
    child.stdin.end("continue");
  });
  child.stderr.on("data", (chunk) => reader.push(chunk));
  child.stdout.on("data", () => {
    receivedPublication = true;
    if (reader.fault) return;
    ready = true;
  });
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    const [code] = await once(child, "close");
    assert.equal(code, 0);
    assert.equal(receivedPublication, true);
    assert.equal(ready, false);
    assert.equal(reader.fault?.code, "publication-limit");
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
});
