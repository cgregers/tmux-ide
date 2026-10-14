import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

describe("renderer-neutral Node connection owner", () => {
  it("bundles without importing TUI modules or UI logging side effects", async () => {
    const entry = fileURLToPath(new URL("./daemon-connection-owner.ts", import.meta.url));
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      write: false,
      metafile: true,
      logLevel: "silent",
    });
    const inputs = Object.keys(result.metafile.inputs);
    expect(inputs.some((path) => path.endsWith("ssh-daemon-transport.ts"))).toBe(true);
    expect(inputs.some((path) => path.endsWith("ssh-daemon-relay.ts"))).toBe(true);
    expect(inputs.filter((path) => /\/(?:tui|widgets)\//u.test(path))).toEqual([]);
    expect(result.outputFiles[0]!.text).not.toContain("application-performance-log");
  });
  it("exports a separate Node boundary without broadening the daemon root", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    );
    expect(manifest.exports["./connection-owner"]).toEqual({
      types: "./dist/lib/daemon-connection-owner.d.ts",
      default: "./dist/lib/daemon-connection-owner.js",
    });
  });
});
