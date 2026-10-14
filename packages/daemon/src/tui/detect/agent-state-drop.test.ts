import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  agentStateFileName,
  agentStateStamp,
  BRIDGED_AGENTS,
  createAgentStateBridge,
  MAX_RECORD_BYTES,
  parseAgentStateRecord,
  readAgentStateDrop,
} from "./agent-state-drop.ts";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "agent-state-drop-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("agent-state drop core", () => {
  it("builds only exact numeric server/pane filenames", () => {
    expect(agentStateFileName("4242", "%7")).toBe("4242-7.state");
    expect(agentStateFileName("0042", "%007")).toBe("0042-007.state");
    for (const pid of ["", "-1", "../4242", "42\n", "42;echo", null, undefined])
      expect(agentStateFileName(pid as string, "%7")).toBeNull();
    for (const pane of ["", "7", "%", "%7\n", "%7/other", "%7;echo"])
      expect(agentStateFileName("4242", pane)).toBeNull();
  });

  it.each(["working", "blocked", "done", "idle"])(
    "parses only the versioned %s record",
    (state) => {
      expect(parseAgentStateRecord(`v1 copilot ${state} 001700000000\n`)).toEqual({
        agent: "copilot",
        state,
        epoch: 1_700_000_000,
      });
      expect(parseAgentStateRecord(`v1 copilot ${state} 0`)).toEqual({
        agent: "copilot",
        state,
        epoch: 0,
      });
    },
  );

  it.each([
    null,
    "",
    "v2 copilot done 42",
    "v1 claude done 42",
    "v1 copilot unknown 42",
    "v1 copilot done -1",
    "v1 copilot done +1",
    "v1 copilot done 1.2",
    "v1 copilot done 1e2",
    "v1 copilot done 1234567890123",
    "v1 copilot done ",
    "v1 copilot done 42 extra",
    "v1 copilot done 42\nextra",
    "v1 copilot done 42\n\n",
    "v1 copilot done 42\r\n",
    " v1 copilot done 42",
    "v1 copilot done 42 ",
    "v1  copilot done 42",
    "v1\tcopilot done 42",
    "v1 copilot done ４２",
    "x".repeat(257),
  ])("ignores malformed records without normalization (%j)", (raw) => {
    expect(parseAgentStateRecord(raw)).toBeNull();
  });

  it("requires the resolved Copilot agent and rejects older records or more than 60s future skew", () => {
    expect(BRIDGED_AGENTS).toEqual(["copilot"]);
    const pane = { paneId: "%7", agent: "copilot", authorityRaw: null };
    const record = { agent: "copilot", state: "done" as const, epoch: 100 };
    const argv = ["set-option", "-p", "-t", "%7", "@agent_state", "done:100"];
    expect(agentStateStamp(pane, record, 100)).toEqual(argv);
    expect(agentStateStamp(pane, record, 40)).toEqual(argv);
    expect(agentStateStamp(pane, record, 39)).toBeNull();
    expect(agentStateStamp({ ...pane, authorityRaw: "working:99" }, record, 100)).toEqual(argv);
    for (const authorityRaw of ["done:100", "idle:101", "working:999"])
      expect(agentStateStamp({ ...pane, authorityRaw }, record, 100)).toBeNull();
    expect(agentStateStamp({ ...pane, authorityRaw: "malformed" }, record, 100)).toEqual(argv);
    expect(agentStateStamp(pane, { ...record, agent: "claude" }, 100)).toBeNull();
    for (const agent of ["claude", "codex", null])
      expect(agentStateStamp({ ...pane, agent }, record, 100)).toBeNull();
    expect(agentStateStamp({ ...pane, paneId: "%7;echo" }, record, 100)).toBeNull();
  });

  it("stamps a different state at the current authority epoch", () => {
    expect(
      agentStateStamp(
        { paneId: "%7", agent: "copilot", authorityRaw: "working:100" },
        { agent: "copilot", state: "blocked", epoch: 100 },
        100,
      ),
    ).toEqual(["set-option", "-p", "-t", "%7", "@agent_state", "blocked:100"]);
  });

  it.each(["blocked:100", " \tblocked:100\n "])(
    "does not re-stamp an identical same-epoch value (%j)",
    (authorityRaw) => {
      expect(
        agentStateStamp(
          { paneId: "%7", agent: "copilot", authorityRaw },
          { agent: "copilot", state: "blocked", epoch: 100 },
          100,
        ),
      ).toBeNull();
    },
  );
});

describe("agent-state drop file io", () => {
  it.each(["missing", "symlink", "fifo", "directory", "oversize"])(
    "treats a %s as absent, without blocking or throwing",
    (kind) => {
      const path = join(root, "4242-7.state");
      if (kind === "directory") mkdirSync(path);
      if (kind === "fifo") execFileSync("mkfifo", [path], { stdio: "ignore" });
      if (kind === "oversize") writeFileSync(path, "x".repeat(MAX_RECORD_BYTES + 1));
      if (kind === "symlink") {
        const target = join(root, "target");
        writeFileSync(target, "v1 copilot done 42\n");
        symlinkSync(target, path);
      }
      expect(readAgentStateDrop(path)).toBeNull();
    },
  );

  it("reads at most the 256-byte budget and requires the current uid", () => {
    const path = join(root, "4242-7.state");
    const content = "x".repeat(MAX_RECORD_BYTES);
    writeFileSync(path, content);
    expect(readAgentStateDrop(path)).toBe(content);
    const uid = process.getuid!();
    vi.spyOn(process, "getuid").mockReturnValue(uid + 1);
    expect(readAgentStateDrop(path)).toBeNull();
  });
});

describe("agent-state bridge", () => {
  it("reads only the Copilot pane's exact server-scoped file and stamps only rebuilt @agent_state argv", () => {
    const serverPid = vi.fn(() => "4242");
    const readRecord = vi.fn(() => "v1 copilot blocked 001700000000\n");
    const stamp = vi.fn();
    const bridge = createAgentStateBridge({
      agentStateDir: "/fixture/drop",
      serverPid,
      readRecord,
      stamp,
      nowSec: () => 1_700_000_000,
    });
    const pane = { paneId: "%7", agent: "copilot", authorityRaw: null };
    bridge.onTick([pane, { ...pane, paneId: "%8", agent: "claude" }]);
    expect(readRecord).toHaveBeenCalledExactlyOnceWith("/fixture/drop/4242-7.state");
    expect(stamp).toHaveBeenCalledExactlyOnceWith([
      "set-option",
      "-p",
      "-t",
      "%7",
      "@agent_state",
      "blocked:1700000000",
    ]);
    bridge.onTick([{ ...pane, authorityRaw: "blocked:1700000000" }]);
    expect(serverPid).toHaveBeenCalledTimes(1);
    expect(stamp).toHaveBeenCalledTimes(1);
  });

  it("applies a same-second working-to-blocked transition without re-stamping unchanged state", () => {
    const stamp = vi.fn();
    const bridge = createAgentStateBridge({
      agentStateDir: root,
      serverPid: () => "4242",
      readRecord: () => "v1 copilot blocked 100\n",
      stamp,
      nowSec: () => 100,
    });
    const pane = { paneId: "%7", agent: "copilot", authorityRaw: "working:100" };
    bridge.onTick([pane]);
    expect(stamp).toHaveBeenCalledExactlyOnceWith([
      "set-option",
      "-p",
      "-t",
      "%7",
      "@agent_state",
      "blocked:100",
    ]);
    bridge.onTick([{ ...pane, authorityRaw: "blocked:100" }]);
    expect(stamp).toHaveBeenCalledTimes(1);
  });

  it("does not reapply a done record after a same-second acknowledgement, but accepts a new state", () => {
    const readRecord = vi.fn(() => "v1 copilot done 100\n");
    const stamps: string[][] = [];
    const bridge = createAgentStateBridge({
      agentStateDir: root,
      serverPid: () => "4242",
      readRecord,
      stamp: (argv) => {
        stamps.push(argv);
      },
      nowSec: () => 100,
    });
    const pane = { paneId: "%7", agent: "copilot", authorityRaw: "working:90" };
    const doneArgv = ["set-option", "-p", "-t", "%7", "@agent_state", "done:100"];
    bridge.onTick([pane]);
    expect(stamps).toEqual([doneArgv]);
    bridge.onTick([{ ...pane, authorityRaw: "idle:100" }]);
    expect(stamps).toEqual([doneArgv]);
    readRecord.mockReturnValue("v1 copilot working 100\n");
    bridge.onTick([{ ...pane, authorityRaw: "idle:100" }]);
    expect(stamps).toEqual([
      doneArgv,
      ["set-option", "-p", "-t", "%7", "@agent_state", "working:100"],
    ]);
  });

  it("forgets successfully applied values when the pane disappears from a tick", () => {
    const stamp = vi.fn();
    const bridge = createAgentStateBridge({
      agentStateDir: root,
      serverPid: () => "4242",
      readRecord: () => "v1 copilot done 100\n",
      stamp,
      nowSec: () => 100,
    });
    const pane = { paneId: "%7", agent: "copilot", authorityRaw: "working:90" };
    bridge.onTick([pane]);
    expect(stamp).toHaveBeenCalledExactlyOnceWith([
      "set-option",
      "-p",
      "-t",
      "%7",
      "@agent_state",
      "done:100",
    ]);
    bridge.onTick([]);
    expect(stamp).toHaveBeenCalledTimes(1);
    bridge.onTick([{ ...pane, authorityRaw: "idle:100" }]);
    expect(stamp).toHaveBeenCalledTimes(2);
  });

  it("bridges a real, owned fixture record through the hardened file adapter", () => {
    const path = join(root, "4242-7.state");
    const record = "v1 copilot done 1700000000\n";
    writeFileSync(path, record, { mode: 0o600 });
    expect(readAgentStateDrop(path)).toBe(record);
    const stamp = vi.fn();
    const bridge = createAgentStateBridge({
      agentStateDir: root,
      serverPid: () => "4242",
      readRecord: readAgentStateDrop,
      stamp,
      nowSec: () => 1_700_000_000,
    });
    bridge.onTick([{ paneId: "%7", agent: "copilot", authorityRaw: null }]);
    expect(stamp).toHaveBeenCalledExactlyOnceWith([
      "set-option",
      "-p",
      "-t",
      "%7",
      "@agent_state",
      "done:1700000000",
    ]);
  });

  it("retries failed stamps next tick rather than marking the record delivered", () => {
    const stamp = vi.fn().mockImplementationOnce(() => {
      throw new Error("synthetic stamp failure");
    });
    const readRecord = vi.fn(() => "v1 copilot working 100\n");
    const bridge = createAgentStateBridge({
      agentStateDir: root,
      serverPid: () => "4242",
      readRecord,
      stamp,
      nowSec: () => 100,
    });
    const panes = [{ paneId: "%7", agent: "copilot", authorityRaw: null }];
    expect(() => bridge.onTick(panes)).not.toThrow();
    bridge.onTick(panes);
    expect(readRecord).toHaveBeenCalledTimes(2);
    expect(stamp).toHaveBeenCalledTimes(2);
    bridge.onTick(panes);
    expect(readRecord).toHaveBeenCalledTimes(3);
    expect(stamp).toHaveBeenCalledTimes(2);
  });

  it("retries transient server lookup failures and caches the first valid server pid", () => {
    const serverPid = vi
      .fn<() => string>()
      .mockImplementationOnce(() => {
        throw new Error("synthetic lookup failure");
      })
      .mockReturnValue("4242");
    const stamp = vi.fn();
    const bridge = createAgentStateBridge({
      agentStateDir: root,
      serverPid,
      readRecord: () => "v1 copilot idle 100\n",
      stamp,
      nowSec: () => 100,
    });
    const panes = [{ paneId: "%7", agent: "copilot", authorityRaw: null }];
    bridge.onTick(panes);
    expect(stamp).not.toHaveBeenCalled();
    bridge.onTick(panes);
    bridge.onTick(panes);
    expect(serverPid).toHaveBeenCalledTimes(2);
    expect(stamp).toHaveBeenCalledTimes(1);
  });

  it("isolates a failed pane read and ignores future records until the clock catches up", () => {
    const stamp = vi.fn();
    let now = 0;
    const bridge = createAgentStateBridge({
      agentStateDir: root,
      serverPid: () => "4242",
      readRecord: (path) => {
        if (path.endsWith("-7.state")) throw new Error("synthetic read failure");
        return "v1 copilot blocked 100\n";
      },
      stamp,
      nowSec: () => now,
    });
    const panes = [
      { paneId: "%7", agent: "copilot", authorityRaw: null },
      { paneId: "%8", agent: "copilot", authorityRaw: null },
    ];
    expect(() => bridge.onTick(panes)).not.toThrow();
    expect(stamp).not.toHaveBeenCalled();
    now = 100;
    bridge.onTick(panes);
    expect(stamp).toHaveBeenCalledExactlyOnceWith([
      "set-option",
      "-p",
      "-t",
      "%8",
      "@agent_state",
      "blocked:100",
    ]);
  });

  it.each([null, "", "bad", "42\n", "-1"])(
    "does no filesystem work without a valid server pid (%j)",
    (pid) => {
      const readRecord = vi.fn();
      const bridge = createAgentStateBridge({
        agentStateDir: root,
        serverPid: () => pid,
        readRecord,
        stamp: vi.fn(),
      });
      bridge.onTick([{ paneId: "%7", agent: "copilot", authorityRaw: null }]);
      expect(readRecord).not.toHaveBeenCalled();
    },
  );

  it("does no io for non-Copilot panes or invalid pane ids", () => {
    const serverPid = vi.fn();
    const readRecord = vi.fn();
    const bridge = createAgentStateBridge({
      agentStateDir: root,
      serverPid,
      readRecord,
      stamp: vi.fn(),
    });
    bridge.onTick([
      { paneId: "%7", agent: "claude", authorityRaw: null },
      { paneId: "%8", agent: null, authorityRaw: null },
      { paneId: "%9/other", agent: "copilot", authorityRaw: null },
    ]);
    expect(serverPid).not.toHaveBeenCalled();
    expect(readRecord).not.toHaveBeenCalled();
  });
});
