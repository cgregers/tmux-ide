import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { z } from "zod";
import {
  PaneEditorContextResponseSchemaZ,
  type PaneEditorContextResponse,
} from "../../../packages/contracts/src/index.ts";
import type { LocalPreviewHostProof } from "./discovery.ts";

export const openEditorSchema = z
  .object({
    type: z.literal("open-editor"),
    request: z.number().int().positive().safe(),
    id: z.string().min(1).max(512),
    token: z.uuid(),
  })
  .strict();

const messages = {
  unavailable: "Open folder requires verified local daemon discovery",
  failed:
    "Could not open folder in VS Code — check VS Code is installed, then reselect the pane and retry",
  stale: "Editor selection changed — select the pane and try again",
  opened: "Folder open request sent to VS Code",
} as const;

async function bounded<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort!: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("Editor request expired"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([operation, cancelled]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

function launch(directory: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "/usr/bin/open",
      ["-b", "com.microsoft.VSCode", directory],
      { timeout: 5000, signal, maxBuffer: 4096, encoding: "utf8" },
      (error) => (error ? reject(new Error("Editor launch failed")) : resolve()),
    );
  });
}

/** Called only by an explicit current native click; no editor command or path comes from it. */
export async function openSelectedPaneEditor(options: {
  proof: LocalPreviewHostProof | null;
  current: () => boolean;
  read: (signal: AbortSignal) => Promise<PaneEditorContextResponse>;
  platform?: NodeJS.Platform;
  inspect?: (directory: string) => Promise<{ isDirectory(): boolean }>;
  launch?: (directory: string, signal: AbortSignal) => Promise<void>;
}): Promise<string> {
  if (!options.proof || (options.platform ?? process.platform) !== "darwin")
    return messages.unavailable;
  const proof = options.proof;
  const signal = AbortSignal.timeout(8000);
  const assertCurrent = () => {
    signal.throwIfAborted();
    if (!options.current()) throw new Error("Selection changed");
    proof.assertCurrent();
  };
  try {
    assertCurrent();
    await proof.verify(signal);
    assertCurrent();
    const response = PaneEditorContextResponseSchemaZ.parse(
      await bounded(options.read(signal), signal),
    );
    assertCurrent();
    const directory = response.context.directory;
    if (
      !isAbsolute(directory) ||
      !(await bounded((options.inspect ?? stat)(directory), signal)).isDirectory()
    )
      throw new Error("Directory unavailable");
    assertCurrent();
    await proof.verify(signal);
    assertCurrent();
    await (options.launch ?? launch)(directory, signal);
    return messages.opened;
  } catch {
    return options.current() ? messages.failed : messages.stale;
  }
}
