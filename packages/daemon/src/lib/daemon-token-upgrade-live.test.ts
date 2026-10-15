import { mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { WebSocket } from "ws";
import { expect, it, vi } from "vitest";
import { startEmbeddedDaemon, type EmbeddedDaemonHandle } from "./daemon-embed.ts";

it("requires the daemon token on loopback WebSocket upgrades", async () => {
  // Keep the owned Unix socket below the platform's path-length limit.
  const root = mkdtempSync("/tmp/tmux-token-");
  const socketPath = join(root, "tmux.sock");
  let tmuxStarted = false;
  let daemon: EmbeddedDaemonHandle | undefined;
  const clients = new Set<WebSocket>();
  const owner = "test-upgrade-owner";
  const remote = "test-upgrade-remote";
  const closed = (ws: WebSocket) =>
    new Promise<number>((resolve, reject) => {
      ws.once("close", resolve);
      ws.once("error", reject);
    });
  try {
    for (const [key, value] of Object.entries({
      TMUX: "",
      TMUX_IDE_HOME: root,
      TMUX_IDE_CONFIG: join(root, "config.json"),
      TMUX_IDE_DAEMON_INFO_DIR: join(root, "daemon"),
      TMUX_IDE_REGISTRY_DIR: join(root, "registry"),
      TMUX_IDE_SETTINGS_DIR: join(root, "settings"),
      TMUX_IDE_TMUX_SOCKET_PATH: socketPath,
      TMUX_IDE_RUNTIME_MODE: "test",
      TMUX_IDE_CLEANUP_TOKEN: "test-token-upgrade",
    }))
      vi.stubEnv(key, value);
    execFileSync(
      "tmux",
      [
        "-S",
        socketPath,
        "-f",
        "/dev/null",
        "new-session",
        "-d",
        "-s",
        "zz-token-upgrade",
        "sleep 300",
      ],
      { env: { ...process.env, TMUX: "" }, stdio: "pipe" },
    );
    tmuxStarted = true;
    daemon = await startEmbeddedDaemon({
      bindHostname: "127.0.0.1",
      authToken: remote,
      localBypassToken: owner,
      silent: true,
    });
    const base = daemon.apiBaseUrl.replace(/^http/, "ws");
    for (const path of ["/ws/events", "/ws/pty/zz-token-test", "/ws/unknown"]) {
      for (const token of [null, "wrong"]) {
        const ws = new WebSocket(`${base}${path}`, {
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
          handshakeTimeout: 2_000,
        });
        clients.add(ws);
        expect(await closed(ws)).toBe(1008);
      }
    }
    for (const path of ["/ws/events", "/ws/pty/zz-token-test"]) {
      for (const token of [owner, remote]) {
        for (const query of [false, true]) {
          const ws = new WebSocket(`${base}${path}${query ? `?token=${token}` : ""}`, {
            headers: query ? {} : { Authorization: `Bearer ${token}` },
            handshakeTimeout: 2_000,
          });
          clients.add(ws);
          await new Promise<void>((resolve, reject) => {
            ws.once("open", resolve);
            ws.once("error", reject);
          });
          const closing = closed(ws);
          ws.close();
          await closing;
        }
      }
    }
  } finally {
    for (const ws of clients) ws.terminate();
    try {
      await daemon?.stop();
    } finally {
      if (tmuxStarted) {
        try {
          execFileSync("tmux", ["-S", socketPath, "kill-server"], { stdio: "pipe" });
        } catch {
          // The daemon may already have retired this owned scratch server.
        }
      }
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  }
}, 30_000);
