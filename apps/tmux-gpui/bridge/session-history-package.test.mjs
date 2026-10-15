// Invalid explicit packages must fail before CLI access, tmux allocation or any daemon launch.
import { test } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, chmod, rm } from "node:fs/promises";
import { join } from "node:path";
import { URL, fileURLToPath } from "node:url";
const run = promisify(execFile);
test(
  "explicit history packages fail before private CLI access; no source fallback",
  { timeout: 20000 },
  async () => {
    const root = await mkdtemp("/tmp/gpui-history-package-");
    try {
      const app = join(root, "Fixture.app"),
        resources = join(app, "Contents/Resources"),
        bridge = join(resources, "bridge");
      await mkdir(bridge, { recursive: true });
      const node = join(resources, "node"),
        browser = join(bridge, "browser.bundle.mjs"),
        live = join(bridge, "live.bundle.mjs");
      await writeFile(node, "not executed\n", { mode: 0o700 });
      await writeFile(browser, "");
      await writeFile(live, "");
      const env = {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith("TMUX") && !["NODE_OPTIONS", "NODE_PATH"].includes(key),
          ),
        ),
        HOME: root,
        XDG_CONFIG_HOME: root,
        XDG_STATE_HOME: root,
        TMPDIR: root,
        TMUX_GPUI_TEST_CLI: join(root, "UNEXPECTED_CLI_READ"),
      };
      const invoke = async (path) => {
        try {
          await run(
            process.execPath,
            [
              "--import",
              import.meta.resolve("tsx"),
              fileURLToPath(new URL("./session-history-smoke.mjs", import.meta.url)),
            ],
            { env: { ...env, TMUX_GPUI_TEST_APP: path }, timeout: 5000, maxBuffer: 65536 },
          );
          assert.fail("Invalid fixture unexpectedly succeeded");
        } catch (error) {
          assert.equal(error.code, 1);
          return error.stderr;
        }
      };
      for (const path of ["", "relative.app", join(root, "missing.app"), node])
        assert.ok(!(await invoke(path)).includes("UNEXPECTED_CLI_READ"));
      await chmod(node, 0o600);
      assert.ok(!(await invoke(app)).includes("UNEXPECTED_CLI_READ"));
      await chmod(node, 0o700);
      await rm(browser);
      await mkdir(browser);
      assert.ok(!(await invoke(app)).includes("UNEXPECTED_CLI_READ"));
      await rm(browser, { recursive: true });
      await writeFile(browser, "");
      await rm(live);
      assert.ok(!(await invoke(app)).includes("UNEXPECTED_CLI_READ"));
      await writeFile(live, "");
      // Positive validation control intentionally stops at the missing CLI, before allocation.
      assert.match(await invoke(app), /UNEXPECTED_CLI_READ/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
