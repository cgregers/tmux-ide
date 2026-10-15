import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { loadLocalSourceImportGraph } from "../../test-support/source-import-graph.ts";
import { createMachineAgents } from "./machine-agents.ts";

describe("shared fleet agent boundary", () => {
  it("bundles against the narrow roster export without a renderer barrel", async () => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL("./machine-agents.ts", import.meta.url))],
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      write: false,
      metafile: true,
      logLevel: "silent",
    });
    const imports = Object.values(result.metafile.outputs).flatMap((output) =>
      output.imports.map((i) => i.path),
    );
    expect(imports).toContain("@tmux-ide/presentation/home-agent-roster");
    expect(imports).not.toContain("@tmux-ide/presentation");
    expect(
      Object.keys(result.metafile.inputs).filter((path) => /\/(?:tui|widgets)\//u.test(path)),
    ).toEqual([]);
  });
  it("has no local import path into TUI discovery, renderer or singleton owners", async () => {
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const graph = await loadLocalSourceImportGraph(root, [
      "packages/daemon/src/lib/machine-agents.ts",
    ]);
    expect(graph.files.filter((path) => path.includes("/tui/"))).toEqual([]);
    expect(graph.files).toContain("packages/daemon/src/lib/home-agent-observer.ts");
    expect(graph.files).toContain("packages/daemon/src/lib/home-agent-transport.ts");
  });
  it("uses only the supplied catalog and manager and disposes its subscription", () => {
    let subscribed = 0;
    let stopped = 0;
    const snapshot = { selectedMachineId: "local", groups: [] };
    const agents = createMachineAgents({
      manager: {
        getMachine: () => {
          throw new Error("empty catalog must not discover any machine");
        },
      },
      catalog: {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          subscribed++;
          listener(snapshot);
          return () => {
            stopped++;
          };
        },
      },
    });
    expect(subscribed).toBe(0);
    agents.start();
    agents.start();
    expect(subscribed).toBe(1);
    expect(agents.getSnapshot()).toEqual([]);
    agents.dispose();
    agents.dispose();
    expect(stopped).toBe(1);
  });
});
