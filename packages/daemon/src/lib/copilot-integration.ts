/**
 * Copilot CLI user-level hooks. Unsandboxed hooks stamp tmux directly; hooks
 * denied the tmux socket can leave a status-only record for the host updater.
 * The writable drop folder must remain separate from host-executed hooks.
 */
import { shellEscape } from "./shell.ts";
import { resolveRuntimeNamespace, runtimeOwnedPath } from "./runtime-namespace.ts";
import { IdeError } from "./errors.ts";
import {
  accessSync,
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { homedir } from "node:os";

export const HOOKS_FILENAME = "tmux-ide.json";

/** POSIX sh + coreutils + tmux only. Never persist or print the event payload. */
export function buildHookScript(agentStateDir: string): string {
  return `#!/bin/sh
# tmux-ide agent-state hook (installed by: tmux-ide integration install copilot)
# Silence every command, including hook failures, and drain stdin on every exit.
exec >/dev/null 2>&1
trap 'cat >/dev/null 2>&1' 0
LC_ALL=C
export LC_ALL
state="\${1:-}"
case "$state" in working|blocked|done|idle) ;; *) exit 0 ;; esac
[ -n "$TMUX_PANE" ] || exit 0
case "$TMUX_PANE" in %*) pane_number="\${TMUX_PANE#%}" ;; *) exit 0 ;; esac
case "$pane_number" in ''|*[!0-9]*) exit 0 ;; esac
index="\${TMUX##*,}"
rest="\${TMUX%,*}"
server_pid="\${rest##*,}"
socket="\${rest%,*}"
case "$index" in ''|*[!0-9]*) exit 0 ;; esac
case "$server_pid" in ''|*[!0-9]*) exit 0 ;; esac
case "$socket" in /*) ;; *) exit 0 ;; esac
[ "$rest" != "$TMUX" ] && [ "$socket" != "$rest" ] || exit 0
drop_dir=${shellEscape(agentStateDir)}
epoch="$(date +%s)" || exit 0
case "$epoch" in ''|*[!0-9]*) exit 0 ;; esac
# Never guess the default socket or accept a stamp from a reused server.
if observed_pid="$(tmux -S "$socket" display-message -p -t "$TMUX_PANE" '#{pid}')" &&
   [ "$observed_pid" = "$server_pid" ]; then
  # Keep at most 64 KiB in memory; the exit trap drains everything else.
  payload="$(head -c 65536)"
  tmux -S "$socket" set-option -p -t "$TMUX_PANE" @agent_state "\${state}:\${epoch}" || exit 0
  tmux -S "$socket" set-option -p -t "$TMUX_PANE" @agent_hint copilot || true
  # Keep payload text inside the shell, never in a parser process's argv.
  case "$payload" in *'"sessionId"'*) ;; *) exit 0 ;; esac
  sid_field="\${payload#*'"sessionId"'}"
  sid_field="\${sid_field#"\${sid_field%%[![:space:]]*}"}"
  case "$sid_field" in :*) sid_field="\${sid_field#?}" ;; *) exit 0 ;; esac
  sid_field="\${sid_field#"\${sid_field%%[![:space:]]*}"}"
  case "$sid_field" in '"'*) sid_field="\${sid_field#?}" ;; *) exit 0 ;; esac
  case "$sid_field" in *'"'*) ;; *) exit 0 ;; esac
  sid="\${sid_field%%'"'*}"
  case "$sid" in ''|*[!A-Za-z0-9_-]*) exit 0 ;; esac
  [ "\${#sid}" -le 128 ] || exit 0
  tmux -S "$socket" set-option -p -t "$TMUX_PANE" @agent_session_id "$sid" || true
  exit 0
fi
# A sandbox record carries only an enum and an epoch, never a resumable id.
[ -d "$drop_dir" ] && [ ! -L "$drop_dir" ] || exit 0
umask 077
temp="$(mktemp "$drop_dir/.rec.XXXXXX")" || exit 0
# Recreate exclusively: a same-uid sandbox writer may replace mktemp's leaf.
# Noclobber must not reopen a symlink/hardlink and truncate a host file.
rm -f "$temp" || exit 0
if ! (set -C; printf 'v1 copilot %s %s\\n' "$state" "$epoch" >"$temp"); then
  rm -f "$temp"
  exit 0
fi
target="$drop_dir/$server_pid-$pane_number.state"
[ ! -d "$target" ] || { rm -f "$temp"; exit 0; }
# BSD mv's documented -h prevents a directory-symlink pivot on Seatbelt hosts.
case "$(uname -s)" in
  Darwin) mv -f -h "$temp" "$target" ;;
  *) mv -f "$temp" "$target" ;;
esac || rm -f "$temp"
exit 0
`;
}

/** CamelCase event names select Copilot's camelCase payload format. */
export const EVENT_STATES = [
  { event: "sessionStart", state: "idle" },
  { event: "userPromptSubmitted", state: "working" },
  { event: "postToolUse", state: "working" },
  { event: "postToolUseFailure", state: "working" },
  {
    event: "notification",
    state: "blocked",
    matcher: "permission_prompt|elicitation_dialog",
  },
  { event: "agentStop", state: "done" },
  { event: "sessionEnd", state: "idle" },
] as const;

interface HookEntry {
  type: "command";
  exec: string;
  args: string[];
  timeoutSec: number;
  matcher?: string;
}

/** PURE — no shell strings, preToolUse, or permissionRequest hooks. */
export function buildHooksConfig(scriptPath: string): {
  version: 1;
  hooks: Record<string, HookEntry[]>;
} {
  return {
    version: 1,
    hooks: Object.fromEntries(
      EVENT_STATES.map((entry) => [
        entry.event,
        [
          {
            type: "command",
            exec: scriptPath,
            args: [entry.state],
            timeoutSec: 5,
            ...("matcher" in entry ? { matcher: entry.matcher } : {}),
          },
        ],
      ]),
    ),
  };
}

export interface CopilotIntegrationPaths {
  scriptPath: string;
  hooksDir: string;
  agentStateDir: string;
}

function integrationPaths(): CopilotIntegrationPaths {
  const namespace = resolveRuntimeNamespace();
  return {
    scriptPath: namespace.copilotHookPath,
    hooksDir: namespace.copilotHooksDir,
    agentStateDir: namespace.agentStateDir,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** PURE — ownership is every hook entry execing our exact script, not a marker substring. */
export function isOurHooksConfig(config: unknown, scriptPath: string): boolean {
  const hooks = object(object(config)?.hooks);
  if (!hooks) return false;
  let count = 0;
  for (const entries of Object.values(hooks)) {
    if (!Array.isArray(entries)) return false;
    for (const entry of entries) {
      if (object(entry)?.exec !== scriptPath) return false;
      count++;
    }
  }
  return count > 0;
}

function pathStat(path: string) {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new IdeError("Unable to inspect Copilot integration paths", {
      code: "COPILOT_INTEGRATION_PATH_INSPECTION_FAILED",
    });
  }
}

function checkDirectory(path: string): void {
  const stat = pathStat(path);
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink()))
    throw new IdeError("Copilot integration requires real, non-symlink directories", {
      code: "COPILOT_INTEGRATION_UNSAFE_DIRECTORY",
    });
}

function ensureDirectory(path: string, mode?: number): void {
  checkDirectory(path);
  mkdirSync(path, { recursive: true, ...(mode === undefined ? {} : { mode }) });
  checkDirectory(path);
  if (mode !== undefined) chmodSync(path, mode);
}

/** Do not follow a replaced file, or block on a substituted FIFO. */
function writeRegularFile(path: string, content: string, mode: number): void {
  const prior = pathStat(path);
  if (prior && (!prior.isFile() || prior.isSymbolicLink()))
    throw new IdeError("Copilot integration requires regular, non-symlink files", {
      code: "COPILOT_INTEGRATION_UNSAFE_FILE",
    });
  const fd = openSync(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    mode,
  );
  try {
    const actual = fstatSync(fd);
    if (!actual.isFile() || (prior && (prior.dev !== actual.dev || prior.ino !== actual.ino)))
      throw new IdeError("Copilot integration file changed during installation", {
        code: "COPILOT_INTEGRATION_FILE_CHANGED",
      });
    ftruncateSync(fd, 0);
    writeFileSync(fd, content, "utf8");
    fchmodSync(fd, mode);
  } finally {
    closeSync(fd);
  }
}

const MAX_HOOKS_BYTES = 65_536;
function readHooksFile(paths: CopilotIntegrationPaths): { config: unknown; issue?: string } {
  let fd: number | undefined;
  try {
    const dir = lstatSync(paths.hooksDir);
    if (!dir.isDirectory() || dir.isSymbolicLink())
      return { config: null, issue: "hooks_dir_unsafe" };
    const path = join(paths.hooksDir, HOOKS_FILENAME);
    const before = lstatSync(path);
    if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_HOOKS_BYTES)
      return { config: null, issue: "hooks_file_unsafe" };
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const actual = fstatSync(fd);
    if (
      !actual.isFile() ||
      actual.size > MAX_HOOKS_BYTES ||
      actual.dev !== before.dev ||
      actual.ino !== before.ino
    )
      return { config: null, issue: "hooks_file_unsafe" };
    const buffer = Buffer.alloc(MAX_HOOKS_BYTES + 1);
    const size = readSync(fd, buffer, 0, buffer.length, 0);
    if (size > MAX_HOOKS_BYTES) return { config: null, issue: "hooks_file_unsafe" };
    return { config: JSON.parse(buffer.toString("utf8", 0, size)) };
  } catch (error) {
    return {
      config: null,
      issue:
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "hooks_file_missing"
          : "hooks_file_invalid",
    };
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Status and ownership checks never surface file contents or raw errors.
      }
    }
  }
}

function registrationComplete(config: unknown, scriptPath: string): boolean {
  if (object(config)?.version !== 1) return false;
  const hooks = object(object(config)?.hooks);
  const expected = buildHooksConfig(scriptPath).hooks;
  return EVENT_STATES.every(({ event }) => {
    const entries = hooks?.[event];
    return (
      Array.isArray(entries) &&
      entries.some((raw) => {
        const entry = object(raw);
        const wanted = expected[event]![0]!;
        return (
          entry?.type === wanted.type &&
          entry.exec === wanted.exec &&
          Array.isArray(entry.args) &&
          entry.args.length === 1 &&
          entry.args[0] === wanted.args[0] &&
          entry.timeoutSec === wanted.timeoutSec &&
          entry.matcher === wanted.matcher &&
          !("bash" in entry || "powershell" in entry || "command" in entry)
        );
      })
    );
  });
}

function inside(path: string, directory: string): boolean {
  const offset = relative(directory, path);
  return offset === "" || (offset !== ".." && !offset.startsWith(`..${sep}`));
}

function integrationOwnedPath(path: string): string {
  try {
    return runtimeOwnedPath(path);
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message === "development path escapes instance authority"
    )
      throw new IdeError(error.message, { code: "COPILOT_INTEGRATION_PATH_ESCAPE" });
    throw error;
  }
}

/** Install is explicit, idempotent, and never changes cplt configuration. */
export function installCopilotIntegration(paths?: CopilotIntegrationPaths) {
  if (!paths && resolveRuntimeNamespace().development)
    throw new IdeError("Development integration installation requires explicit fixture paths", {
      code: "COPILOT_INTEGRATION_FIXTURE_REQUIRED",
    });
  paths ??= integrationPaths();
  const hooksFilePath = join(paths.hooksDir, HOOKS_FILENAME);
  for (const path of [...Object.values(paths), hooksFilePath]) {
    if (!isAbsolute(path))
      throw new IdeError("Copilot integration paths must be absolute", {
        code: "COPILOT_INTEGRATION_PATH_NOT_ABSOLUTE",
      });
    integrationOwnedPath(path);
  }
  if (inside(paths.scriptPath, paths.agentStateDir) || inside(hooksFilePath, paths.agentStateDir))
    throw new IdeError("Copilot drop folder must not contain host hooks or their configuration", {
      code: "COPILOT_INTEGRATION_DROP_OVERLAP",
    });
  for (const stateRoot of [resolveRuntimeNamespace().stateHome, join(homedir(), ".tmux-ide")])
    if (inside(stateRoot, paths.agentStateDir))
      throw new IdeError("Copilot drop folder must not grant tmux-ide state roots", {
        code: "COPILOT_INTEGRATION_DROP_OVERLAP",
      });
  for (const dir of [dirname(paths.scriptPath), paths.hooksDir, paths.agentStateDir])
    checkDirectory(dir);
  const existing = readHooksFile(paths);
  if (
    existing.issue !== "hooks_file_missing" &&
    (existing.issue || !isOurHooksConfig(existing.config, paths.scriptPath))
  )
    throw new IdeError("Copilot hooks file is foreign, invalid or unsafe — left untouched", {
      code: "COPILOT_INTEGRATION_UNSAFE_HOOKS_FILE",
    });
  ensureDirectory(dirname(paths.scriptPath));
  ensureDirectory(paths.hooksDir);
  ensureDirectory(paths.agentStateDir, 0o700);
  writeRegularFile(paths.scriptPath, buildHookScript(paths.agentStateDir), 0o755);
  writeRegularFile(
    hooksFilePath,
    `${JSON.stringify(buildHooksConfig(paths.scriptPath), null, 2)}\n`,
    0o600,
  );
  return { ...paths, hooksFilePath };
}

/** Leave scripts and records inert; remove only an owned registration file. */
export function uninstallCopilotIntegration(paths = integrationPaths()) {
  const hooksFilePath = integrationOwnedPath(join(paths.hooksDir, HOOKS_FILENAME));
  const { config, issue } = readHooksFile(paths);
  const wasInstalled = !issue && isOurHooksConfig(config, paths.scriptPath);
  if (wasInstalled) rmSync(hooksFilePath, { force: true });
  return {
    hooksFilePath,
    wasInstalled,
    issues: wasInstalled || issue === "hooks_file_missing" ? [] : [issue ?? "hooks_file_not_owned"],
  };
}

/** Readiness only, not proof that a running Copilot session delivers events. */
export function copilotIntegrationStatus(paths = integrationPaths()) {
  const { config, issue } = readHooksFile(paths);
  const issues: string[] = issue ? [issue] : [];
  const hooksFileOwned = !issue && isOurHooksConfig(config, paths.scriptPath);
  if (!issue && !hooksFileOwned) issues.push("hooks_file_not_owned");
  const complete = registrationComplete(config, paths.scriptPath);
  if (!complete) issues.push("registration_incomplete");
  let scriptExists = false;
  let scriptCurrent = false;
  let scriptExecutable = false;
  try {
    const stat = lstatSync(paths.scriptPath);
    scriptExists = stat.isFile() && !stat.isSymbolicLink();
    if (scriptExists) {
      scriptCurrent =
        readFileSync(paths.scriptPath, "utf8") === buildHookScript(paths.agentStateDir);
      accessSync(paths.scriptPath, constants.X_OK);
      scriptExecutable = true;
    }
  } catch {
    // Safe categories only; never print hook contents.
  }
  if (!scriptExists) issues.push("script_missing");
  else {
    if (!scriptCurrent) issues.push("script_outdated");
    if (!scriptExecutable) issues.push("script_not_executable");
  }
  let dropDirExists = false;
  try {
    const stat = lstatSync(paths.agentStateDir);
    dropDirExists = stat.isDirectory() && !stat.isSymbolicLink();
    if (dropDirExists && (stat.mode & 0o777) !== 0o700) issues.push("drop_dir_not_private");
  } catch {
    // Missing or unreadable is reported below.
  }
  if (!dropDirExists) issues.push("drop_dir_missing");
  return {
    installed: issues.length === 0,
    scriptExists,
    scriptCurrent,
    scriptExecutable,
    hooksFileOwned,
    registrationComplete: complete,
    dropDirExists,
    issues,
    deliveryVerified: false as const,
    scope: "user-hooks" as const,
    hooksFilePath: join(paths.hooksDir, HOOKS_FILENAME),
  };
}
