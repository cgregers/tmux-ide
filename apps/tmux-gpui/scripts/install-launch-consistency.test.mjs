// Executable path qualification only: inert children, injected test verification, no GUI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { installApp, rollbackApp, uninstallApp } from "./install-transaction.mjs";
import { stopFixtureChild } from "../bridge/fixture-child.mjs";

// Extract the exact assembly template rather than maintaining a second launcher.
const assembly = await readFile(new URL("./assemble-local-app.mjs", import.meta.url), "utf8");
const template = assembly.match(/`(#!\/bin\/sh\n[\s\S]*?)`,\n\s*\{ mode: 0o755 \}/);
assert.ok(template, "expected unique generated launcher template");
const launcher = template[1].replaceAll("\\${", "${");
const exec = promisify(execFile);

for (const operation of ["update", "rollback", "detach", "direct"]) {
  test(
    `installed launcher pins one retained version during ${operation}`,
    { timeout: 15000 },
    async () => {
      const root = await realpath(await mkdtemp(join(tmpdir(), "gpui-launch-pin-")));
      let child;
      try {
        const installRoot = join(root, "Installed Apps");
        const verify = async () => true; // Test seam only; never supplied to the public CLI.
        async function stage(version) {
          const app = join(root, `stage-${version}`);
          await mkdir(join(app, "Contents/MacOS"), { recursive: true });
          await mkdir(join(app, "Contents/Resources/bridge"), { recursive: true });
          await writeFile(join(app, "Contents/MacOS/tmux-ide-launcher"), launcher, { mode: 0o755 });
          await writeFile(
            join(app, "Contents/Resources/node"),
            `#!/bin/sh\nset -eu\necho NODE_${version}\nIFS= read -r release\nexec "$1" "$2"\n`,
            { mode: 0o755 },
          );
          await writeFile(
            join(app, "Contents/Resources/bridge/preview-launcher.bundle.mjs"),
            `#!/bin/sh\nset -eu\necho HELPER_${version}\nexec "$1"\n`,
            { mode: 0o755 },
          );
          await writeFile(
            join(app, "Contents/MacOS/tmux-ide-gpui"),
            `#!/bin/sh\necho NATIVE_${version}\n`,
            { mode: 0o755 },
          );
          return app;
        }
        const v1 = await stage("one"),
          v2 = await stage("two");
        await installApp({ installRoot, stagedApp: v1, version: "one", verify });
        if (operation === "rollback")
          await installApp({ installRoot, stagedApp: v2, version: "two", verify });
        const initial = operation === "rollback" ? "two" : "one";
        let output = "",
          errors = "",
          fatal,
          closed;
        const appPath =
          operation === "direct"
            ? join(installRoot, "versions/one/TmuxIDE.app")
            : join(installRoot, "TmuxIDE.app");
        child = spawn(join(appPath, "Contents/MacOS/tmux-ide-launcher"), [], {
          cwd: root,
          env: { HOME: root, PATH: "/usr/bin:/bin" },
          stdio: ["pipe", "pipe", "pipe"],
        });
        child.on("error", (error) => {
          fatal ??= error;
        });
        child.stdin.on("error", (error) => {
          fatal ??= error;
        });
        child.stdout.on("data", (data) => {
          if (output.length < 4096) output += data;
          else fatal ??= new Error("Unexpected output");
        });
        child.stderr.on("data", (data) => {
          if (errors.length < 4096) errors += data;
          else fatal ??= new Error("Unexpected stderr");
        });
        child.on("close", (code, signal) => {
          closed = { code, signal };
        });
        async function until(predicate) {
          const deadline = Date.now() + 5000;
          while (true) {
            if (fatal) throw fatal;
            if (predicate()) return;
            if (Date.now() > deadline) throw new Error("Owned launcher deadline");
            await delay(10);
          }
        }
        await until(() => output === `NODE_${initial}\n`);
        if (operation === "update")
          await installApp({ installRoot, stagedApp: v2, version: "two", verify });
        else if (operation === "rollback") await rollbackApp({ installRoot, verify });
        else if (operation === "detach") await uninstallApp({ installRoot });
        assert.equal(closed, undefined, "pointer transaction must not stop the owned launcher");
        child.stdin.end("continue\n");
        await until(() => closed !== undefined);
        assert.deepEqual(closed, { code: 0, signal: null }, errors);
        assert.equal(errors, "");
        assert.equal(output, `NODE_${initial}\nHELPER_${initial}\nNATIVE_${initial}\n`);
        const stableLauncher = join(installRoot, "TmuxIDE.app/Contents/MacOS/tmux-ide-launcher");
        const nextLauncher =
          operation === "detach"
            ? join(installRoot, "versions/one/TmuxIDE.app/Contents/MacOS/tmux-ide-launcher")
            : stableLauncher;
        if (operation === "detach")
          await assert.rejects(realpath(stableLauncher), { code: "ENOENT" });
        const next = await exec(
          "/bin/sh",
          ["-c", 'printf "continue\\n" | "$1"', "launch-control", nextLauncher],
          {
            cwd: root,
            env: { HOME: root, PATH: "/usr/bin:/bin" },
            timeout: 5000,
            maxBuffer: 4096,
          },
        );
        const nextVersion = operation === "update" ? "two" : "one";
        assert.equal(next.stderr, "");
        assert.equal(
          next.stdout,
          `NODE_${nextVersion}\nHELPER_${nextVersion}\nNATIVE_${nextVersion}\n`,
        );
      } finally {
        try {
          if (child) await stopFixtureChild(child);
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }
    },
  );
}
