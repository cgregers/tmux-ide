import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { _resetCacheForTests, projectRegistryEmitter } from "../lib/project-registry.ts";
import {
  _detachProjectRegistryListenerForTests,
  _setFleetFactsReadersForTests,
  _stopFleetFactsObserverForTests,
  handleWsEventsConnection,
} from "./ws-events.ts";
import { _setExecutor, type PaneInfo } from "../widgets/lib/pane-comms.ts";
import { _setTmuxRunner } from "./discovery.ts";
import { createAuthenticatedTestApp as createApp } from "./authenticated-test-app.ts";
import { makePane } from "../__tests__/support.ts";
import type { ServerFrame } from "../schemas/ws-events.ts";

const REGISTRY_DIR_ENV = "TMUX_IDE_REGISTRY_DIR";
const TEST_DAEMON_IDENTITY = {
  protocolVersion: 1,
  productVersion: "2.8.0",
  instanceId: "9bcf33b0-c837-4a94-b5e8-c0977f54464f",
  startedAt: "2026-07-21T00:00:00.000Z",
} as const;

class MockWebSocket extends EventEmitter {
  readyState = 1;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.emit("close");
  }

  receive(text: string): void {
    this.emit("message", text, false);
  }

  clientClose(): void {
    this.readyState = 3;
    this.emit("close");
  }
}

function frames(ws: MockWebSocket): ServerFrame[] {
  return ws.sent.map((s) => JSON.parse(s) as ServerFrame);
}

async function tick(ms = 10): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

let registryHome: string;
let projectDir: string;
let sandboxRoot: string;
let originalHomeOverride: string | undefined;
let restorePane: () => void;
let restoreTmux: () => void;

beforeEach(() => {
  registryHome = mkdtempSync(join(tmpdir(), "tmux-ide-projects-"));
  projectDir = mkdtempSync(join(tmpdir(), "tmux-ide-proj-"));
  // Sandbox boundary for inspect/onboard endpoints — must be canonical so
  // the realpath() check in the route accepts paths inside it on macOS.
  sandboxRoot = realpathSync(tmpdir());
  originalHomeOverride = process.env.TMUX_IDE_HOME_OVERRIDE;
  process.env.TMUX_IDE_HOME_OVERRIDE = sandboxRoot;
  process.env[REGISTRY_DIR_ENV] = registryHome;
  _resetCacheForTests();

  // Mock pane + tmux helpers so createApp() runs cleanly without real tmux.
  const mockPanes: PaneInfo[] = [makePane({ id: "%1", index: 0, title: "Shell", active: true })];
  restorePane = _setExecutor((_cmd: string, args: string[]) => {
    if (args[0] === "list-panes") {
      return mockPanes
        .map(
          (p) =>
            `${p.id}\t${p.index}\t${p.title}\t${p.currentCommand}\t${p.width}\t${p.height}\t${p.active ? "1" : "0"}\t${p.role ?? ""}\t${p.name ?? ""}\t${p.type ?? ""}`,
        )
        .join("\n");
    }
    return "";
  });
  restoreTmux = _setTmuxRunner((args: string[]) => {
    if (args[0] === "list-sessions") return "";
    return "";
  });
  _setFleetFactsReadersForTests({
    readSessions: async () => ({ sessions: [], adopted: [] }),
    readAgents: async () => new Map(),
  });
});

afterEach(() => {
  delete process.env[REGISTRY_DIR_ENV];
  if (originalHomeOverride === undefined) {
    delete process.env.TMUX_IDE_HOME_OVERRIDE;
  } else {
    process.env.TMUX_IDE_HOME_OVERRIDE = originalHomeOverride;
  }
  rmSync(registryHome, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
  _resetCacheForTests();
  restorePane?.();
  restoreTmux?.();
  _stopFleetFactsObserverForTests();
  _setFleetFactsReadersForTests(null);
  _detachProjectRegistryListenerForTests();
});

describe("REST /api/projects", () => {
  it("GET returns an empty list when nothing is registered", async () => {
    const app = createApp();
    const res = await app.request("/api/projects");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { projects: unknown[] };
    expect(body.projects).toEqual([]);
  });

  it("POST registers a project and GET surfaces it", async () => {
    const app = createApp();
    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dir: projectDir }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as { project: { name: string; dir: string } };
    expect(created.project.dir).toBe(projectDir);

    const list = await app.request("/api/projects").then(
      (r) =>
        r.json() as Promise<{
          projects: { name: string }[];
        }>,
    );
    expect(list.projects).toHaveLength(1);
    expect(list.projects[0]!.name).toBe(created.project.name);
  });

  it("POST can register a live-only fixture without serializing it", async () => {
    const app = createApp();
    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dir: projectDir,
        name: "performance-fixture",
        persistence: "volatile",
      }),
    });
    expect(res.status).toBe(201);
    expect(
      (await app.request("/api/projects").then((response) => response.json())) as unknown,
    ).toEqual(
      expect.objectContaining({
        projects: [expect.objectContaining({ name: "performance-fixture" })],
      }),
    );
    const persisted = JSON.parse(readFileSync(join(registryHome, "projects.json"), "utf8")) as {
      projects: unknown[];
    };
    expect(persisted.projects).toEqual([]);
  });

  it("POST returns 400 when the directory does not exist", async () => {
    const app = createApp();
    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dir: "/does/not/exist" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST returns 409 with a suggested alt name on conflict", async () => {
    const app = createApp();
    const otherDir = mkdtempSync(join(tmpdir(), "tmux-ide-other-"));
    try {
      const first = await app.request("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: projectDir, name: "shared" }),
      });
      expect(first.status).toBe(201);

      const conflict = await app.request("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: otherDir, name: "shared" }),
      });
      expect(conflict.status).toBe(409);
      const body = (await conflict.json()) as { suggestion: string };
      expect(body.suggestion).toBe("shared-2");
    } finally {
      rmSync(otherDir, { recursive: true, force: true });
    }
  });

  it("DELETE removes a registered project", async () => {
    const app = createApp();
    const created = await app
      .request("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: projectDir }),
      })
      .then((r) => r.json() as Promise<{ project: { name: string } }>);

    const del = await app.request(`/api/projects/${created.project.name}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(200);

    const list = (await app.request("/api/projects").then((r) => r.json())) as {
      projects: unknown[];
    };
    expect(list.projects).toEqual([]);
  });

  it("DELETE returns 404 for unknown project", async () => {
    const app = createApp();
    const res = await app.request("/api/projects/nope", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("GET /api/projects/templates returns at least the bundled set", async () => {
    const app = createApp();
    const res = await app.request("/api/projects/templates");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      templates: { id: string; label: string; description: string }[];
    };
    expect(body.templates.length).toBeGreaterThan(0);
    const ids = body.templates.map((t) => t.id);
    expect(ids).toContain("default");
    expect(ids).toContain("nextjs");
  });
});

describe("WS broadcast — projects.changed", () => {
  it("connected clients receive projects.changed when a project is registered", async () => {
    const app = createApp();
    const ws = new MockWebSocket();
    handleWsEventsConnection(ws, TEST_DAEMON_IDENTITY);
    ws.receive(JSON.stringify({ type: "subscribe", sessions: [] }));
    ws.sent.length = 0;

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dir: projectDir }),
    });
    expect(res.status).toBe(201);
    await tick();

    const types = frames(ws).map((f) => f.type);
    expect(types).toContain("projects.changed");

    ws.clientClose();
  });

  it("listener counts return to baseline after disconnect", () => {
    const before = projectRegistryEmitter.listenerCount("change");

    const ws = new MockWebSocket();
    handleWsEventsConnection(ws, TEST_DAEMON_IDENTITY);
    ws.receive(JSON.stringify({ type: "subscribe", sessions: [] }));
    expect(projectRegistryEmitter.listenerCount("change")).toBe(before + 1);

    ws.clientClose();
    expect(projectRegistryEmitter.listenerCount("change")).toBe(before);
  });
});

describe("retired REST /api/filesystem/inspect", () => {
  it("does not expose the removed inspection route", async () => {
    const app = createApp();
    const res = await app.request("/api/filesystem/inspect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dir: projectDir }),
    });
    expect(res.status).toBe(404);
    expect(existsSync(join(projectDir, ".tmux-ide", "workspace.yml"))).toBe(false);
    const body = await app.request("/api/projects").then((r) => r.json());
    expect(body.projects).toEqual([]);
  });
});

// Sanity check: registry survives "registered → fs file → fresh app" round-trip.
describe("end-to-end registry persistence", () => {
  it("re-creating the app reads back persisted projects", async () => {
    const app1 = createApp();
    const created = await app1
      .request("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir: projectDir }),
      })
      .then((r) => r.json() as Promise<{ project: { name: string } }>);

    // Drop the in-memory cache; new app instance must re-read from disk.
    _resetCacheForTests();
    const app2 = createApp();
    const list = (await app2.request("/api/projects").then((r) => r.json())) as {
      projects: { name: string }[];
    };
    expect(list.projects.map((p) => p.name)).toContain(created.project.name);

    const file = join(registryHome, "projects.json");
    expect(existsSync(file)).toBe(true);
  });
});
