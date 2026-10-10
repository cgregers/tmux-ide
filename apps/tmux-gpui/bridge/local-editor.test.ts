import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openSelectedPaneEditor, openEditorSchema } from "./local-editor.ts";
const generation = randomUUID();
const response = {
  version: 1 as const,
  server: { serverId: `tmux-server.${"a".repeat(32)}`, generation },
  context: {
    generation,
    workspaceName: "project",
    liveSessionId: `live-session.${"b".repeat(20)}`,
    semanticPaneId: "pane.main",
    cwd: { kind: "absolute" as const, path: "/tmp/工作 '-flag" },
    directory: "/tmp/工作 '-flag",
  },
};
function fixture() {
  const stages: string[] = [];
  let current = true;
  return {
    stages,
    revoke: () => {
      current = false;
    },
    options: {
      proof: {
        assertCurrent() {
          stages.push("record");
        },
        async verify() {
          stages.push("identity");
        },
      },
      current: () => current,
      async read() {
        stages.push("context");
        return response;
      },
      platform: "darwin" as const,
      async inspect(directory: string) {
        assert.equal(directory, response.context.directory);
        stages.push("directory");
        return { isDirectory: () => true };
      },
      async launch(directory: string) {
        assert.equal(directory, response.context.directory);
        stages.push("launch");
      },
    },
  };
}
test("opens only after local identity, context, directory and final locality/currentness checks", async () => {
  const f = fixture();
  assert.equal(await openSelectedPaneEditor(f.options), "Folder open request sent to VS Code");
  assert.deepEqual(
    f.stages.filter((s) => s !== "record"),
    ["identity", "context", "directory", "identity", "launch"],
  );
});
test("explicit/unverified hosts and unsupported platforms never read paths or launch", async () => {
  for (const patch of [{ proof: null }, { platform: "linux" as const }]) {
    const f = fixture();
    assert.match(await openSelectedPaneEditor({ ...f.options, ...patch }), /verified local/);
    assert.deepEqual(f.stages, []);
  }
});
test("navigation/background at every awaited stage prevents launch", async () => {
  for (const step of ["identity", "context", "directory"] as const) {
    const f = fixture();
    if (step === "identity")
      f.options.proof.verify = async () => {
        f.revoke();
      };
    if (step === "context")
      f.options.read = async () => {
        f.revoke();
        return response;
      };
    if (step === "directory")
      f.options.inspect = async () => {
        f.revoke();
        return { isDirectory: () => true };
      };
    assert.match(await openSelectedPaneEditor(f.options), /selection changed/);
    assert.ok(!f.stages.includes("launch"));
  }
});
test("record replacement, non-directory, malformed context and launcher failure return fixed guidance", async () => {
  for (const step of ["record", "directory", "context", "launch"] as const) {
    const f = fixture();
    if (step === "record")
      f.options.proof.assertCurrent = () => {
        throw new Error("SECRET-record");
      };
    if (step === "directory") f.options.inspect = async () => ({ isDirectory: () => false });
    if (step === "context")
      f.options.read = async () => ({
        ...response,
        context: { ...response.context, directory: "file:///SECRET" },
      });
    if (step === "launch")
      f.options.launch = async () => {
        throw new Error("SECRET-launch");
      };
    const result = await openSelectedPaneEditor(f.options);
    assert.match(result, /Could not open/);
    assert.ok(!result.includes("SECRET"));
    if (step !== "launch") assert.ok(!f.stages.includes("launch"));
  }
  assert.equal(
    openEditorSchema.safeParse({
      type: "open-editor",
      request: 1,
      id: "pane.main",
      token: randomUUID(),
      path: "/injected",
    }).success,
    false,
  );
});
