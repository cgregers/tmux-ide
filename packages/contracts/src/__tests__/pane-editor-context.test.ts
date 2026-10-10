import { expect, it } from "vitest";
import {
  PaneEditorContextResponseSchemaZ,
  PaneEditorContextTargetSchemaZ,
} from "../pane-editor-context.ts";
const generation = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const target = {
  generation,
  workspaceName: "project",
  liveSessionId: `live-session.${"b".repeat(20)}`,
  semanticPaneId: "pane.main",
};
const response = (directory: string) => ({
  version: 1,
  server: { serverId: `tmux-server.${"a".repeat(32)}`, generation },
  context: { ...target, directory, cwd: { kind: "absolute", path: directory } },
});
it("accepts exact POSIX, drive and UNC absolute observations without converting paths", () => {
  for (const path of [
    "/tmp/工作 ",
    "/tmp/literal\\name",
    "C:\\Projects\\repo",
    "C:/Projects/repo",
    "\\\\server\\share\\repo",
  ])
    expect(PaneEditorContextResponseSchemaZ.parse(response(path)).context.directory).toBe(path);
});
it("rejects URI/relative/NUL/oversized directories and inconsistent or unbounded envelopes", () => {
  for (const path of [
    "relative",
    "C:relative",
    "\\relative",
    "file:///tmp/a",
    "/tmp/\0a",
    "/" + "a".repeat(4096),
  ])
    expect(PaneEditorContextResponseSchemaZ.safeParse(response(path)).success).toBe(false);
  const r = response("/tmp/a");
  expect(
    PaneEditorContextResponseSchemaZ.safeParse({ ...r, rawSocket: "/private/socket" }).success,
  ).toBe(false);
  expect(
    PaneEditorContextResponseSchemaZ.safeParse({
      ...r,
      context: { ...r.context, cwd: { kind: "absolute", path: "/other" } },
    }).success,
  ).toBe(false);
  expect(
    PaneEditorContextResponseSchemaZ.safeParse({
      ...r,
      server: { ...r.server, generation: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    }).success,
  ).toBe(false);
  expect(
    PaneEditorContextTargetSchemaZ.safeParse({ ...target, directory: "/caller" }).success,
  ).toBe(false);
});
