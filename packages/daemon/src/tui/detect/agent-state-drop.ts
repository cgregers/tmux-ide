/**
 * Status-only cplt → host bridge, pulsed by the single chrome updater.
 * Records are hostile input: no directory scans, shell commands, session ids,
 * hints, or free text may cross this boundary.
 */
import { join } from "node:path";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  type Stats,
} from "node:fs";
import { parseAuthorityEpoch, type AgentStatus } from "./classify.ts";

export const BRIDGED_AGENTS = ["copilot"] as const;
export const MAX_RECORD_BYTES = 256;
export type ReportedAgentState = Exclude<AgentStatus, "unknown">;

export interface AgentStateRecord {
  agent: string;
  state: ReportedAgentState;
  epoch: number;
}

export interface BridgePane {
  paneId: string;
  agent: string | null;
  authorityRaw: string | null;
}

function decimalIdentifier(value: string): boolean {
  return typeof value === "string" && /^[0-9]+$/u.exec(value)?.[0] === value;
}

/** PURE — filenames contain only server/pane numbers, never caller-supplied paths. */
export function agentStateFileName(serverPid: string, paneId: string): string | null {
  if (
    !decimalIdentifier(serverPid) ||
    typeof paneId !== "string" ||
    /^%[0-9]+$/u.exec(paneId)?.[0] !== paneId
  )
    return null;
  return `${serverPid}-${paneId.slice(1)}.state`;
}

/** PURE — exact, bounded versioned grammar; even a second trailing newline is rejected. */
export function parseAgentStateRecord(raw: string | null): AgentStateRecord | null {
  if (typeof raw !== "string" || raw.length > MAX_RECORD_BYTES) return null;
  const match = /^v1 copilot (working|blocked|done|idle) ([0-9]{1,12})\n?$/u.exec(raw);
  // JS `$` can match before a final newline; require the entire input too.
  if (!match || match[0] !== raw) return null;
  return { agent: "copilot", state: match[1] as ReportedAgentState, epoch: Number(match[2]) };
}

/**
 * PURE — never apply older records, with a bounded future-clock allowance.
 * The drop file always holds the hook's latest record, so a different value
 * at the same epoch is newer information; identical values are a no-op each tick.
 */
export function agentStateStamp(
  pane: BridgePane,
  record: AgentStateRecord,
  nowSec: number,
): string[] | null {
  if (
    !BRIDGED_AGENTS.some((agent) => agent === pane.agent) ||
    record.agent !== pane.agent ||
    agentStateFileName("0", pane.paneId) === null ||
    !Number.isFinite(nowSec) ||
    record.epoch > nowSec + 60
  )
    return null;
  const current = parseAuthorityEpoch(pane.authorityRaw ?? undefined);
  if (current !== null && record.epoch < current) return null;
  const value = `${record.state}:${record.epoch}`;
  if (record.epoch === current && value === pane.authorityRaw?.trim()) return null;
  return ["set-option", "-p", "-t", pane.paneId, "@agent_state", value];
}

function safeRecordFile(stat: Stats, uid: number): boolean {
  return (
    stat.isFile() &&
    !stat.isSymbolicLink() &&
    stat.uid === uid &&
    stat.size >= 0 &&
    stat.size <= MAX_RECORD_BYTES
  );
}

/** Thin, never-throwing io. No symlink following, FIFO blocking, or unbounded reads. */
export function readAgentStateDrop(path: string): string | null {
  let fd: number | undefined;
  try {
    const uid = process.getuid?.();
    if (
      uid === undefined ||
      typeof constants.O_NOFOLLOW !== "number" ||
      typeof constants.O_NONBLOCK !== "number"
    )
      return null; // Do not silently weaken the boundary on unsupported platforms.
    const before = lstatSync(path);
    if (!safeRecordFile(before, uid)) return null;
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = fstatSync(fd);
    if (!safeRecordFile(opened, uid) || opened.dev !== before.dev || opened.ino !== before.ino)
      return null;
    const buffer = Buffer.alloc(MAX_RECORD_BYTES);
    let size = 0;
    while (size < opened.size) {
      const read = readSync(fd, buffer, size, opened.size - size, size);
      if (read === 0) break;
      size += read;
    }
    const after = fstatSync(fd);
    if (!safeRecordFile(after, uid) || size !== after.size) return null;
    return buffer.toString("utf8", 0, size);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Never log record content, paths, or raw filesystem errors.
      }
    }
  }
}

export interface AgentStateBridgeDeps {
  agentStateDir: string;
  /** The tmux server's #{pid}, not pane_pid; cache only a successful resolution. */
  serverPid: () => string | null;
  readRecord: (path: string) => string | null;
  stamp: (argv: string[]) => void;
  nowSec?: () => number;
}

/**
 * Stateful identity cache and thin injected io. Remember only successfully
 * applied values for currently eligible panes; failed stamps remain retryable.
 */
export function createAgentStateBridge(deps: AgentStateBridgeDeps): {
  onTick: (panes: BridgePane[]) => void;
} {
  let serverPid: string | null = null;
  const lastApplied = new Map<string, string>();
  const nowSec = deps.nowSec ?? (() => Math.floor(Date.now() / 1000));
  return {
    onTick(panes) {
      const eligible = panes.filter(
        (pane) =>
          BRIDGED_AGENTS.some((agent) => agent === pane.agent) &&
          agentStateFileName("0", pane.paneId) !== null,
      );
      const eligibleIds = new Set(eligible.map((pane) => pane.paneId));
      for (const paneId of lastApplied.keys()) {
        if (!eligibleIds.has(paneId)) lastApplied.delete(paneId);
      }
      if (eligible.length === 0) return;
      if (serverPid === null) {
        try {
          const observed = deps.serverPid();
          if (observed === null || !decimalIdentifier(observed)) return;
          serverPid = observed;
        } catch {
          return; // A transient resolution failure can retry next tick.
        }
      }
      for (const pane of eligible) {
        try {
          const name = agentStateFileName(serverPid, pane.paneId);
          if (!name) continue;
          const record = parseAgentStateRecord(deps.readRecord(join(deps.agentStateDir, name)));
          if (!record) continue;
          const value = `${record.state}:${record.epoch}`;
          if (lastApplied.get(pane.paneId) === value) continue;
          const argv = agentStateStamp(pane, record, nowSec());
          if (argv) {
            deps.stamp(argv);
            lastApplied.set(pane.paneId, value);
          }
        } catch {
          // No paths/content in logs. A failed read or stamp retries next tick.
        }
      }
    },
  };
}
