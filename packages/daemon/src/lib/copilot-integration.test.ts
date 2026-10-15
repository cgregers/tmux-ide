import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  buildHookScript,
  buildHooksConfig,
  copilotIntegrationStatus,
  installCopilotIntegration,
  isOurHooksConfig,
  uninstallCopilotIntegration,
} from "./copilot-integration.ts";
import { developmentNamespaceEnvironment } from "./runtime-namespace.ts";
import { resolveDevelopmentInstance } from "./development-instance.ts";
import { createAgentStateBridge, readAgentStateDrop } from "../tui/detect/agent-state-drop.ts";
import { IdeError } from "./errors.ts";

let root: string;
let paths: { scriptPath: string; hooksDir: string; agentStateDir: string };
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "copilot-hooks-")));
  paths = {
    scriptPath: join(root, "host-hooks", "copilot-state.sh"),
    hooksDir: join(root, "user-hooks"),
    agentStateDir: join(root, "drop with spaces and 'quote"),
  };
  vi.stubEnv("TMUX_IDE_COPILOT_HOOK_PATH", paths.scriptPath);
  vi.stubEnv("TMUX_IDE_COPILOT_HOOKS_DIR", paths.hooksDir);
  vi.stubEnv("TMUX_IDE_AGENT_STATE_DIR", paths.agentStateDir);
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

function hookFixture() {
  const bin = join(root, "bin");
  const logPath = join(root, "argv.log");
  mkdirSync(bin);
  mkdirSync(dirname(paths.scriptPath), { recursive: true });
  writeFileSync(paths.scriptPath, buildHookScript(paths.agentStateDir));
  writeFileSync(
    join(bin, "tmux"),
    `#!/bin/sh
printf '%s\\0' "$@" >> "$FAKE_TMUX_LOG"
printf '\\n' >> "$FAKE_TMUX_LOG"
if [ "$FAKE_TMUX_FAIL" = 1 ]; then
  printf 'synthetic tmux failure\\n' >&2
  exit 1
fi
if [ "$3" = display-message ]; then printf '%s\\n' "$FAKE_TMUX_PID"; fi
`,
    { mode: 0o755 },
  );
  writeFileSync(join(bin, "date"), "#!/bin/sh\nprintf '1700000000\\n'\n", { mode: 0o755 });
  return {
    run: (state = "working", input = "{}", overrides: NodeJS.ProcessEnv = {}) =>
      spawnSync("sh", [paths.scriptPath, state], {
        input,
        encoding: "utf8",
        timeout: 2000,
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          TMUX: "/fixture/socket,4242,0",
          TMUX_PANE: "%7",
          FAKE_TMUX_LOG: logPath,
          FAKE_TMUX_PID: "4242",
          ...overrides,
        },
      }),
    log: (): string[][] =>
      existsSync(logPath)
        ? readFileSync(logPath, "utf8")
            .split("\n")
            .filter(Boolean)
            .map((line) => line.split("\0").slice(0, -1))
        : [],
  };
}

function expectIntegrationRefusal(run: () => unknown, code: string, message: string): void {
  let failure: unknown;
  try {
    run();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(IdeError);
  expect(failure).toMatchObject({ code, message, exitCode: 1 });
  expect((failure as IdeError).toJSON()).toEqual({ error: message, code });
}

describe("Copilot hooks configuration", () => {
  it("registers exactly the seven camelCase events using direct exec and args", () => {
    const exec = "/fixture with spaces/it's-private/copilot-state.sh";
    const command = (state: string) => ({ type: "command", exec, args: [state], timeoutSec: 5 });
    expect(buildHooksConfig(exec)).toEqual({
      version: 1,
      hooks: {
        sessionStart: [command("idle")],
        userPromptSubmitted: [command("working")],
        postToolUse: [command("working")],
        postToolUseFailure: [command("working")],
        notification: [{ ...command("blocked"), matcher: "permission_prompt|elicitation_dialog" }],
        agentStop: [command("done")],
        sessionEnd: [command("idle")],
      },
    });
  });

  it("requires a non-empty hooks object whose every entry execs our exact path", () => {
    const ours = buildHooksConfig(paths.scriptPath);
    expect(isOurHooksConfig(ours, paths.scriptPath)).toBe(true);
    for (const value of [
      null,
      [],
      {},
      { hooks: {} },
      { hooks: { agentStop: [] } },
      { hooks: { agentStop: {} } },
    ])
      expect(isOurHooksConfig(value, paths.scriptPath)).toBe(false);
    ours.hooks.agentStop!.push({
      type: "command",
      exec: "/foreign/hook.sh",
      args: ["done"],
      timeoutSec: 5,
    });
    expect(isOurHooksConfig(ours, paths.scriptPath)).toBe(false);
    expect(
      isOurHooksConfig(
        { hooks: { agentStop: [{ exec: `${paths.scriptPath}.foreign` }] } },
        paths.scriptPath,
      ),
    ).toBe(false);
  });
});

describe("Copilot installation", () => {
  it("installs real hook files and a private drop folder, with idempotent readiness", () => {
    expect(copilotIntegrationStatus(paths).installed).toBe(false);
    const result = installCopilotIntegration(paths);
    expect(result).toEqual({ ...paths, hooksFilePath: join(paths.hooksDir, "tmux-ide.json") });
    expect(readFileSync(paths.scriptPath, "utf8")).toBe(buildHookScript(paths.agentStateDir));
    expect(JSON.parse(readFileSync(result.hooksFilePath, "utf8"))).toEqual(
      buildHooksConfig(paths.scriptPath),
    );
    expect(lstatSync(paths.hooksDir).isSymbolicLink()).toBe(false);
    expect(lstatSync(result.hooksFilePath).isFile()).toBe(true);
    expect(lstatSync(result.hooksFilePath).isSymbolicLink()).toBe(false);
    expect(statSync(paths.scriptPath).mode & 0o777).toBe(0o755);
    expect(statSync(paths.agentStateDir).mode & 0o777).toBe(0o700);
    const once = readFileSync(result.hooksFilePath, "utf8");
    installCopilotIntegration(paths);
    expect(readFileSync(result.hooksFilePath, "utf8")).toBe(once);
    expect(copilotIntegrationStatus(paths)).toMatchObject({
      installed: true,
      scriptExists: true,
      scriptCurrent: true,
      scriptExecutable: true,
      hooksFileOwned: true,
      registrationComplete: true,
      dropDirExists: true,
      issues: [],
      deliveryVerified: false,
    });
  });

  it("uninstalls only our registration, leaving the inert script, drop folder and other hooks", () => {
    const { hooksFilePath } = installCopilotIntegration(paths);
    const other = join(paths.hooksDir, "unrelated.json");
    writeFileSync(other, '{"synthetic":"unrelated"}\n');
    expect(uninstallCopilotIntegration(paths)).toMatchObject({
      hooksFilePath,
      wasInstalled: true,
      issues: [],
    });
    expect(existsSync(hooksFilePath)).toBe(false);
    expect(existsSync(paths.scriptPath)).toBe(true);
    expect(existsSync(paths.agentStateDir)).toBe(true);
    expect(readFileSync(other, "utf8")).toBe('{"synthetic":"unrelated"}\n');
    expect(uninstallCopilotIntegration(paths).wasInstalled).toBe(false);
  });

  it.each([
    "invalid JSON",
    "null",
    "[]",
    '{"version":1,"hooks":{"agentStop":[{"exec":"/foreign/hook.sh"}]}}',
  ])(
    "preserves a foreign or malformed tmux-ide.json during install and uninstall (%s)",
    (content) => {
      mkdirSync(paths.hooksDir);
      mkdirSync(dirname(paths.scriptPath));
      writeFileSync(paths.scriptPath, "existing fixture script");
      const file = join(paths.hooksDir, "tmux-ide.json");
      writeFileSync(file, content);
      expectIntegrationRefusal(
        () => installCopilotIntegration(paths),
        "COPILOT_INTEGRATION_UNSAFE_HOOKS_FILE",
        "Copilot hooks file is foreign, invalid or unsafe — left untouched",
      );
      expect(uninstallCopilotIntegration(paths)).toMatchObject({ wasInstalled: false });
      expect(uninstallCopilotIntegration(paths).issues.length).toBeGreaterThan(0);
      expect(readFileSync(file, "utf8")).toBe(content);
      expect(readFileSync(paths.scriptPath, "utf8")).toBe("existing fixture script");
      expect(copilotIntegrationStatus(paths).hooksFileOwned).toBe(false);
      expect(JSON.stringify(copilotIntegrationStatus(paths))).not.toContain(content);
    },
  );

  it("does not delete an installed hooks file edited to include a foreign exec", () => {
    const { hooksFilePath } = installCopilotIntegration(paths);
    const config = buildHooksConfig(paths.scriptPath);
    config.hooks.notification![0]!.exec = "/foreign/edited-hook.sh";
    const content = JSON.stringify(config);
    writeFileSync(hooksFilePath, content);
    expect(uninstallCopilotIntegration(paths)).toMatchObject({
      wasInstalled: false,
      issues: ["hooks_file_not_owned"],
    });
    expect(readFileSync(hooksFilePath, "utf8")).toBe(content);
  });

  it("reports and repairs incomplete registration, outdated/non-executable scripts and non-private drops", () => {
    const { hooksFilePath } = installCopilotIntegration(paths);
    const config = buildHooksConfig(paths.scriptPath);
    delete config.hooks.postToolUseFailure;
    writeFileSync(hooksFilePath, JSON.stringify(config));
    writeFileSync(paths.scriptPath, "#!/bin/sh\nexit 0\n");
    chmodSync(paths.scriptPath, 0o600);
    chmodSync(paths.agentStateDir, 0o755);
    expect(copilotIntegrationStatus(paths)).toMatchObject({
      installed: false,
      hooksFileOwned: true,
      registrationComplete: false,
      scriptExists: true,
      scriptCurrent: false,
      scriptExecutable: false,
      dropDirExists: true,
      issues: [
        "registration_incomplete",
        "script_outdated",
        "script_not_executable",
        "drop_dir_not_private",
      ],
      deliveryVerified: false,
    });
    installCopilotIntegration(paths);
    expect(copilotIntegrationStatus(paths).installed).toBe(true);
  });

  it.each(["directory", "file"])("refuses a symlinked hooks %s without following it", (kind) => {
    const other = join(root, "other");
    const hooksFilePath = join(paths.hooksDir, "tmux-ide.json");
    if (kind === "directory") {
      mkdirSync(other);
      writeFileSync(
        join(other, "tmux-ide.json"),
        JSON.stringify(buildHooksConfig(paths.scriptPath)),
      );
      symlinkSync(other, paths.hooksDir);
    } else {
      mkdirSync(paths.hooksDir);
      writeFileSync(other, JSON.stringify(buildHooksConfig(paths.scriptPath)));
      symlinkSync(other, hooksFilePath);
    }
    expectIntegrationRefusal(
      () => installCopilotIntegration(paths),
      kind === "directory"
        ? "COPILOT_INTEGRATION_UNSAFE_DIRECTORY"
        : "COPILOT_INTEGRATION_UNSAFE_HOOKS_FILE",
      kind === "directory"
        ? "Copilot integration requires real, non-symlink directories"
        : "Copilot hooks file is foreign, invalid or unsafe — left untouched",
    );
    expect(uninstallCopilotIntegration(paths).wasInstalled).toBe(false);
    expect(copilotIntegrationStatus(paths).hooksFileOwned).toBe(false);
    expect(existsSync(other)).toBe(true);
    expect(lstatSync(kind === "directory" ? paths.hooksDir : hooksFilePath).isSymbolicLink()).toBe(
      true,
    );
    expect(existsSync(paths.scriptPath)).toBe(false);
  });

  it("refuses a drop folder that is a symlink or contains host persistence", () => {
    const other = join(root, "other");
    mkdirSync(other);
    symlinkSync(other, paths.agentStateDir);
    expectIntegrationRefusal(
      () => installCopilotIntegration(paths),
      "COPILOT_INTEGRATION_UNSAFE_DIRECTORY",
      "Copilot integration requires real, non-symlink directories",
    );
    expectIntegrationRefusal(
      () => installCopilotIntegration({ ...paths, agentStateDir: root }),
      "COPILOT_INTEGRATION_DROP_OVERLAP",
      "Copilot drop folder must not contain host hooks or their configuration",
    );
    expect(readdirSync(other)).toEqual([]);
  });

  it("honors explicit environment fixture paths for default installation and status", () => {
    const result = installCopilotIntegration();
    expect(result).toMatchObject(paths);
    expect(copilotIntegrationStatus().installed).toBe(true);
    expect(uninstallCopilotIntegration().wasInstalled).toBe(true);
  });

  it("never offers the state home itself as a sandbox-writable drop folder, even with separate hooks", () => {
    const stateHome = join(root, "state-home");
    vi.stubEnv("TMUX_IDE_HOME", stateHome);
    expectIntegrationRefusal(
      () => installCopilotIntegration({ ...paths, agentStateDir: stateHome }),
      "COPILOT_INTEGRATION_DROP_OVERLAP",
      "Copilot drop folder must not grant tmux-ide state roots",
    );
    expect(existsSync(stateHome)).toBe(false);
  });

  it("requires explicit fixture paths in development and confines them to the instance", () => {
    const instance = resolveDevelopmentInstance({
      worktree: root,
      store: join(root, "store"),
      userHome: root,
    });
    const env = developmentNamespaceEnvironment(instance, "copilot:install:fixture");
    vi.stubEnv("TMUX", "");
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    paths = {
      scriptPath: env.TMUX_IDE_COPILOT_HOOK_PATH!,
      hooksDir: env.TMUX_IDE_COPILOT_HOOKS_DIR!,
      agentStateDir: env.TMUX_IDE_AGENT_STATE_DIR!,
    };
    mkdirSync(instance.stateHome, { recursive: true, mode: 0o700 });
    expectIntegrationRefusal(
      () => installCopilotIntegration(),
      "COPILOT_INTEGRATION_FIXTURE_REQUIRED",
      "Development integration installation requires explicit fixture paths",
    );
    expectIntegrationRefusal(
      () => installCopilotIntegration({ ...paths, scriptPath: join(root, "foreign.sh") }),
      "COPILOT_INTEGRATION_PATH_ESCAPE",
      "development path escapes instance authority",
    );
    installCopilotIntegration(paths);
    expect(copilotIntegrationStatus(paths).installed).toBe(true);
  });
});

describe("Copilot hook execution", () => {
  it("quietly stamps state, hint and a safe camelCase sessionId on the verified tmux server", () => {
    const hook = hookFixture();
    const result = hook.run(
      "working",
      JSON.stringify({ sessionId: "session_123", prompt: "ignored" }),
    );
    expect(result.error).toBeUndefined();
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(hook.log()).toEqual([
      ["-S", "/fixture/socket", "display-message", "-p", "-t", "%7", "#{pid}"],
      [
        "-S",
        "/fixture/socket",
        "set-option",
        "-p",
        "-t",
        "%7",
        "@agent_state",
        "working:1700000000",
      ],
      ["-S", "/fixture/socket", "set-option", "-p", "-t", "%7", "@agent_hint", "copilot"],
      ["-S", "/fixture/socket", "set-option", "-p", "-t", "%7", "@agent_session_id", "session_123"],
    ]);
  });

  it.each([{ FAKE_TMUX_FAIL: "1" }, { FAKE_TMUX_PID: "9999" }])(
    "falls back to a status-only record when tmux is unreachable or belongs to another server (%j)",
    (overrides) => {
      const hook = hookFixture();
      mkdirSync(paths.agentStateDir, { mode: 0o700 });
      const input = JSON.stringify({
        sessionId: "synthetic_private_sid",
        prompt: "synthetic_payload_marker",
      });
      const result = hook.run("blocked", input, overrides);
      expect(result.error).toBeUndefined();
      expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
      expect(readdirSync(paths.agentStateDir)).toEqual(["4242-7.state"]);
      const record = join(paths.agentStateDir, "4242-7.state");
      expect(readFileSync(record, "utf8")).toBe("v1 copilot blocked 1700000000\n");
      expect(statSync(record).mode & 0o777).toBe(0o600);
      const hostWrites: string[][] = [];
      createAgentStateBridge({
        agentStateDir: paths.agentStateDir,
        serverPid: () => "4242",
        readRecord: readAgentStateDrop,
        stamp: (argv) => {
          hostWrites.push(argv);
        },
        nowSec: () => 1_700_000_000,
      }).onTick([{ paneId: "%7", agent: "copilot", authorityRaw: null }]);
      expect(hostWrites).toEqual([
        ["set-option", "-p", "-t", "%7", "@agent_state", "blocked:1700000000"],
      ]);
      expect(hook.log()).toEqual([
        ["-S", "/fixture/socket", "display-message", "-p", "-t", "%7", "#{pid}"],
      ]);
      for (const file of [
        paths.scriptPath,
        record,
        join(root, "argv.log"),
        join(root, "bin", "tmux"),
        join(root, "bin", "date"),
      ]) {
        const content = readFileSync(file, "utf8");
        expect(content).not.toContain("synthetic_payload_marker");
        expect(content).not.toContain("synthetic_private_sid");
      }
    },
  );

  it.each(["", "unknown", "working;echo"])(
    "ignores invalid state %j and drains stdin quietly",
    (state) => {
      const hook = hookFixture();
      mkdirSync(paths.agentStateDir);
      const result = hook.run(state, "x".repeat(100_000));
      expect(result.error).toBeUndefined();
      expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
      expect(hook.log()).toEqual([]);
      expect(readdirSync(paths.agentStateDir)).toEqual([]);
    },
  );

  it.each([
    { TMUX_PANE: undefined },
    { TMUX_PANE: "" },
    { TMUX_PANE: "7" },
    { TMUX_PANE: "%" },
    { TMUX_PANE: "%7/other" },
    { TMUX_PANE: "%7\n" },
    { TMUX: undefined },
    { TMUX: "relative,4242,0" },
    { TMUX: "/socket,pid,0" },
    { TMUX: "/socket,4242,index" },
    { TMUX: "/socket,4242" },
    { TMUX: "/socket" },
  ])("ignores missing or malformed tmux authority (%j)", (overrides) => {
    const hook = hookFixture();
    mkdirSync(paths.agentStateDir);
    const result = hook.run("done", "{}", overrides);
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(hook.log()).toEqual([]);
    expect(readdirSync(paths.agentStateDir)).toEqual([]);
  });

  it.each(["missing", "symlink", "file"])("does not write through a %s drop folder", (kind) => {
    const hook = hookFixture();
    const other = join(root, "other");
    mkdirSync(other);
    if (kind === "symlink") symlinkSync(other, paths.agentStateDir);
    if (kind === "file") writeFileSync(paths.agentStateDir, "unchanged");
    const result = hook.run("idle", "{}", { FAKE_TMUX_FAIL: "1" });
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(readdirSync(other)).toEqual([]);
    if (kind === "file") expect(readFileSync(paths.agentStateDir, "utf8")).toBe("unchanged");
  });

  it.each([
    {},
    { session_id: "snake_case" },
    { sessionId: 42 },
    { sessionId: null },
    { sessionId: "" },
    { sessionId: "a b" },
    { sessionId: "a;echo" },
    { sessionId: "a".repeat(129) },
    { sessionId: 'a"b' },
  ])("never stamps a missing or unsafe sessionId (%j)", (payload) => {
    const hook = hookFixture();
    const result = hook.run("done", JSON.stringify(payload));
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(hook.log().map((args) => args[6])).toEqual(["#{pid}", "@agent_state", "@agent_hint"]);
  });

  it.each(["A", "a".repeat(128)])("accepts safe sessionId boundary length %s", (sessionId) => {
    const hook = hookFixture();
    const result = hook.run("idle", `{\n  "sessionId" : "${sessionId}"\n}`);
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(hook.log().at(-1)?.slice(-2)).toEqual(["@agent_session_id", sessionId]);
  });

  it("does not extract sessionId beyond the first 64 KiB and drains the rest", () => {
    const hook = hookFixture();
    const result = hook.run(
      "working",
      JSON.stringify({ prompt: "x".repeat(70_000), sessionId: "too_late" }),
    );
    expect(result.error).toBeUndefined();
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(hook.log().map((args) => args[6])).toEqual(["#{pid}", "@agent_state", "@agent_hint"]);
  });

  it("never exposes the payload in an external parser's command arguments", () => {
    const hook = hookFixture();
    const argvDump = join(root, "parser-argv");
    writeFileSync(
      join(root, "bin", "expr"),
      "#!/bin/sh\nprintf '%s' \"$1\" > \"$FAKE_PARSER_ARGV\"\nprintf 'session_123\\n'\n",
      { mode: 0o755 },
    );
    const result = hook.run(
      "working",
      JSON.stringify({ sessionId: "session_123", prompt: "synthetic_private_payload" }),
      { FAKE_PARSER_ARGV: argvDump },
    );
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(existsSync(argvDump)).toBe(false);
    expect(hook.log().at(-1)?.slice(-2)).toEqual(["@agent_session_id", "session_123"]);
  });

  it("keeps the envelope sessionId instead of a later toolArgs sessionId", () => {
    const hook = hookFixture();
    const result = hook.run(
      "working",
      JSON.stringify({ sessionId: "envelope_id", toolArgs: { sessionId: "nested_id" } }),
    );
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(hook.log().at(-1)?.slice(-2)).toEqual(["@agent_session_id", "envelope_id"]);
  });

  it("does not truncate a fixture victim if the allocated temporary file is replaced by a symlink", () => {
    const hook = hookFixture();
    mkdirSync(paths.agentStateDir);
    const victim = join(root, "victim");
    writeFileSync(victim, "unchanged synthetic fixture");
    writeFileSync(
      join(root, "bin", "mktemp"),
      `#!/bin/sh
temp="$FAKE_DROP/.rec.fixture"
ln -s "$FAKE_VICTIM" "$temp"
printf '%s\\n' "$temp"
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(root, "bin", "rm"),
      `#!/bin/sh
/bin/rm "$@"
if [ ! -e "$FAKE_RM_MARKER" ]; then
  touch "$FAKE_RM_MARKER"
  for target do :; done
  ln -s "$FAKE_VICTIM" "$target"
fi
`,
      { mode: 0o755 },
    );
    const result = hook.run("working", "{}", {
      FAKE_TMUX_FAIL: "1",
      FAKE_DROP: paths.agentStateDir,
      FAKE_VICTIM: victim,
      FAKE_RM_MARKER: join(root, "rm-first-invocation"),
    });
    expect(result.error).toBeUndefined();
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(readFileSync(victim, "utf8")).toBe("unchanged synthetic fixture");
  });

  (process.platform === "darwin" ? it : it.skip)(
    "does not publish outside the drop folder if a directory symlink appears at rename time on macOS",
    () => {
      const hook = hookFixture();
      mkdirSync(paths.agentStateDir);
      const outside = join(root, "outside");
      mkdirSync(outside);
      writeFileSync(
        join(root, "bin", "mv"),
        `#!/bin/sh
for target do :; done
ln -s "$FAKE_OUTSIDE" "$target"
exec /bin/mv "$@"
`,
        { mode: 0o755 },
      );
      const result = hook.run("done", "{}", { FAKE_TMUX_FAIL: "1", FAKE_OUTSIDE: outside });
      expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
      expect(readdirSync(outside)).toEqual([]);
      expect(lstatSync(join(paths.agentStateDir, "4242-7.state")).isFile()).toBe(true);
    },
  );

  it("removes its temporary record if publication fails, without any output", () => {
    const hook = hookFixture();
    mkdirSync(paths.agentStateDir);
    writeFileSync(
      join(root, "bin", "mv"),
      "#!/bin/sh\nprintf 'synthetic failure\\n' >&2\nexit 1\n",
      { mode: 0o755 },
    );
    const result = hook.run("done", "{}", { FAKE_TMUX_FAIL: "1" });
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
    expect(readdirSync(paths.agentStateDir)).toEqual([]);
  });
});
