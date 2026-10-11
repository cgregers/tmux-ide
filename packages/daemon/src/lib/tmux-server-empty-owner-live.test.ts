import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createTmuxServerProbe } from "./tmux-server-registration.ts";
import { createNativeTmuxServerOwner, type NativeTmuxServerOwner } from "./tmux-server-owner.ts";

it("retained empty owner creates its first session while its sibling remains unchanged", async () => {
  const executable = realpathSync(execFileSync("which", ["tmux"], { encoding: "utf8" }).trim());
  const root = mkdtempSync("/tmp/tmux-empty-owner-");
  const sockets = [root + "/empty", root + "/sibling"];
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("TMUX")),
  );
  const run = (socket: string, args: string[]) =>
    execFileSync(executable, ["-S", socket, ...args], {
      env,
      encoding: "utf8",
      timeout: 5000,
    }).trimEnd();
  const created: string[] = [];
  let owner: NativeTmuxServerOwner | undefined;
  const failures: unknown[] = [];
  try {
    for (const socket of sockets) {
      created.push(socket);
      run(socket, ["-f", "/dev/null", "new-session", "-d", "-s", "owned", "sleep 60"]);
    }
    run(sockets[0]!, ["set-option", "-s", "exit-empty", "off"]);
    run(sockets[0]!, ["kill-session", "-t", "owned"]);
    expect(run(sockets[0]!, ["-N", "list-sessions"])).toBe("");
    const fingerprint = () =>
      run(sockets[1]!, [
        "list-panes",
        "-a",
        "-F",
        "#{pid}|#{session_id}|#{window_id}|#{pane_id}|#{pane_pid}|#{pane_current_command}",
      ]);
    const siblingBefore = fingerprint();
    const observed = await createTmuxServerProbe(executable)({ kind: "path", path: sockets[0]! });
    expect(observed).not.toBeNull();
    const generation = randomUUID();
    owner = await createNativeTmuxServerOwner({
      environmentId: randomUUID(),
      serverId: `tmux-server.${randomUUID().replaceAll("-", "")}`,
      generation,
      tmuxAuthority: observed!.authority,
      nativeServerIdentity: observed!.nativeServerIdentity,
      stateDirectory: root + "/state",
      webSocketUrl: "ws://127.0.0.1:1/v2/terminal/pane-streams/redeem",
    });
    expect(await owner.catalog()).toEqual([]);
    const result = await owner.createSession(randomUUID(), {
      displayName: "First",
      includeLiveSessionId: true,
      expectedDaemonInstanceId: generation,
      cwd: root,
    });
    const rows = await owner.catalog();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.liveSessionId).toBe(result.liveSessionId);
    expect(rows[0]!.paneCount).toBe(1);
    expect(fingerprint()).toBe(siblingBefore);
    await owner.dispose();
    owner = undefined;
    expect(run(sockets[0]!, ["list-sessions", "-F", "#{session_name}"])).toBe(rows[0]!.sessionName);
    expect(fingerprint()).toBe(siblingBefore);
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      await owner?.dispose();
    } catch (error) {
      failures.push(error);
    }
    for (const socket of created) {
      try {
        run(socket, ["-N", "kill-server"]);
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      rmSync(root, { recursive: true, force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "Private empty-server fixture failed");
}, 30000);
