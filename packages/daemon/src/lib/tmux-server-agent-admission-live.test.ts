import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createNativeTmuxServerOwner } from "./tmux-server-owner.ts";
import {
  fallbackPaneId,
  agentIdForPaneStamp,
} from "../command-center/resources/application-shell.ts";
// Explicit qualification opt-in: ordinary/stock installations need not provide birth IDs.
const executablePath = process.env.TMUX_AGENT_ADMISSION_TEST_TMUX;
it.skipIf(!executablePath)(
  "admits the exact unstamped pane among duplicate labels and preserves it on repeat",
  async () => {
    const root = mkdtempSync("/tmp/agent-admit-");
    const socket = join(root, "socket");
    const run = (...args: string[]) =>
      execFileSync(executablePath!, ["-S", socket, "-f", "/dev/null", ...args], {
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, TMUX: "" },
      }).trim();
    let owner: Awaited<ReturnType<typeof createNativeTmuxServerOwner>> | undefined;
    try {
      run("new-session", "-d", "-s", "ordinary", "exec sleep 60");
      run("split-window", "-h", "-t", "ordinary", "exec sleep 60");
      const ids = run("list-panes", "-t", "ordinary", "-F", "#{session_id}\t#{pane_id}").split(
        "\n",
      );
      for (const row of ids)
        run("set-option", "-p", "-t", row.split("\t")[1]!, "@agent_display_name", "Duplicate");
      owner = await createNativeTmuxServerOwner({
        environmentId: randomUUID(),
        serverId: `tmux-server.${"a".repeat(32)}`,
        generation: randomUUID(),
        tmuxAuthority: {
          executablePath: executablePath!,
          socketSelector: { kind: "path", path: socket },
        },
        stateDirectory: join(root, "state"),
        webSocketUrl: "ws://127.0.0.1:12345/v2/terminal/pane-streams/redeem",
      });
      const session = (await owner.catalog())[0]!;
      const [runtimeSessionId, runtimePaneId] = ids[1]!.split("\t");
      const observedPaneId = fallbackPaneId(
        { name: "ordinary", runtimeSessionId: runtimeSessionId! },
        { runtimePaneId: runtimePaneId! },
      );
      const observed = {
        observedPaneId,
        observedAgentId: agentIdForPaneStamp(observedPaneId),
      };
      const admission = owner.openAgent(session.liveSessionId, observed);
      // Caller mutation during catalog refresh cannot retarget an admitted request.
      observed.observedPaneId = "terminal.discovered.invalid";
      observed.observedAgentId = "agent.invalid";
      const opened = await admission;
      expect(opened.semanticPaneId).toBe(
        run("display-message", "-p", "-t", runtimePaneId!, "#{@tmux_ide_pane_id}"),
      );
      expect(
        await owner.openAgent(session.liveSessionId, {
          observedPaneId: opened.semanticPaneId,
          observedAgentId: agentIdForPaneStamp(opened.semanticPaneId),
        }),
      ).toEqual(opened);
      await expect(
        owner.openAgent(session.liveSessionId, {
          observedPaneId,
          observedAgentId: agentIdForPaneStamp(observedPaneId),
        }),
      ).rejects.toThrow();
    } finally {
      await owner?.dispose();
      try {
        run("kill-server");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  },
  30000,
);
