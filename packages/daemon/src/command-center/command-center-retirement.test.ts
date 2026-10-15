import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it.each([
  {
    command: "command-center",
    message: "The standalone command-center is retired. Run `tmux-ide app` instead.",
  },
  {
    command: "server",
    message:
      "`tmux-ide server` is retired. Run `tmux-ide app` (or `tmux-ide --headless` for the daemon) instead.",
  },
])("rejects the retired $command without attempting to listen", ({ command, message }) => {
  const home = mkdtempSync(`${tmpdir()}/tmux-ide-retired-cli-`);
  try {
    const listenerAttempt = join(home, "listener-attempt");
    const guard = join(home, "no-listen.cjs");
    // Detect any port or Unix-socket listen without opening a real listener.
    writeFileSync(
      guard,
      `const { Server } = require("node:net");
const { writeFileSync } = require("node:fs");
Server.prototype.listen = function () {
  writeFileSync(${JSON.stringify(listenerAttempt)}, "listener attempted");
  throw new Error("Unexpected listener attempt");
};
`,
    );
    const result = spawnSync(
      process.execPath,
      [
        "--require",
        guard,
        fileURLToPath(new URL("../../../../bin/cli.js", import.meta.url)),
        command,
      ],
      {
        cwd: home,
        env: { ...process.env, TMUX_IDE_HOME: home, TMUX_IDE_CONFIG: `${home}/config.json` },
        encoding: "utf8",
        timeout: 5_000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(existsSync(listenerAttempt)).toBe(false);
    expect(result.stdout + result.stderr).toContain(message);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
