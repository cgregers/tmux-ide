import { describe, expect, it } from "vitest";
import { createApp, type CreateAppOptions } from "./server.ts";

describe("daemon API credential boundary", () => {
  it("authenticates reads, auth routes and early-mounted issuance before their handlers", async () => {
    const app = createApp({ remoteAccess: { ownerToken: "test-owner" } });
    for (const path of [
      "/api/projects/templates",
      "/api/auth/challenge",
      "/api/v1/terminal/attachments/issue",
      "/api/v2/terminal/pane-streams/issue",
      "/api/diagnostics",
      "/api/unknown",
    ]) {
      const response = await app.request(path);
      expect(response.status, path).toBe(401);
      expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    }
  });

  it.each(["127.0.0.1", "::1", "localhost"])(
    "accepts the owner bearer on a loopback bind: %s",
    async (bindHostname) => {
      const response = await createApp({
        remoteAccess: { bindHostname, ownerToken: "test-owner" },
      }).request("/api/projects/templates", {
        headers: { Authorization: "Bearer test-owner" },
      });
      expect(response.status).toBe(200);
    },
  );

  it.each(["test-owner", "test-bypass", "test-remote"])(
    "accepts a held credential on a non-loopback bind: %s",
    async (token) => {
      const app = createApp({
        remoteAccess: {
          bindHostname: "0.0.0.0",
          ownerToken: "test-owner",
          localBypassToken: "test-bypass",
          token: "test-remote",
        },
      });
      for (const query of [false, true]) {
        const response = await app.request(
          `/api/projects/templates${query ? `?token=${token}` : ""}`,
          { headers: query ? {} : { Authorization: `Bearer ${token}` } },
        );
        expect(response.status).toBe(200);
        expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
      }
      const mixed = await app.request(`/api/projects/templates?token=${token}`, {
        headers: { Authorization: "Bearer project.jwt.signature" },
      });
      expect(mixed.status).toBe(200);
      for (const wrong of ["x", "wrong-owner", "test-owner-with-more-bytes"]) {
        const response = await app.request("/api/projects/templates", {
          headers: { Authorization: `Bearer ${wrong}` },
        });
        expect(response.status).toBe(401);
        const wrongQuery = await app.request(`/api/projects/templates?token=${wrong}`, {
          headers: { Authorization: "Bearer project.jwt.signature" },
        });
        expect(wrongQuery.status).toBe(401);
      }
    },
  );

  it("tries both credential channels and fails closed with no held credential", async () => {
    const app = createApp({ remoteAccess: { ownerToken: "test-owner" } });
    expect(
      (
        await app.request("/api/projects/templates?token=test-owner", {
          headers: { Authorization: "Bearer wrong" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request("/api/projects/templates?token=wrong", {
          headers: { Authorization: "Bearer project.jwt.signature" },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await createApp().request("/api/projects/templates?token=test-owner", {
          headers: { Authorization: "Bearer test-owner" },
        })
      ).status,
    ).toBe(401);
  });

  it("does not grant cross-origin preflights or expose credentials in public probes", async () => {
    const app = createApp({ remoteAccess: { ownerToken: "test-owner" } });
    const preflight = await app.request("/api/projects", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization",
      },
    });
    expect(preflight.status).toBe(401);
    expect(preflight.headers.has("Access-Control-Allow-Origin")).toBe(false);
    for (const path of ["/health", "/healthz", "/identity"]) {
      const response = await app.request(path);
      expect(response.status).toBe(200);
      expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
      const text = await response.text();
      expect(text).not.toContain("test-owner");
      expect(text).not.toMatch(/"(?:(?:auth|owner|localBypass)Token|secret)"/i);
    }
  });

  it("retires unused legacy mutations even for an authenticated caller", async () => {
    const app = createApp({ remoteAccess: { ownerToken: "test-owner" } });
    const routes = [
      ...["send", "inject", "config", "restart", "launch", "stop"].map((action) => [
        "POST",
        `/api/project/zz-probe-nonexistent/${action}`,
      ]),
      ["DELETE", "/api/project/zz-probe-nonexistent/terminals/test"],
      ["POST", "/api/projects/zz-probe-nonexistent/probe"],
      ["POST", "/api/projects/init"],
      ["POST", "/api/projects/onboard"],
    ];
    for (const [method, path] of routes) {
      expect((await app.request(path!, { method })).status).toBe(401);
      const response = await app.request(path!, {
        method,
        headers: { Authorization: "Bearer test-owner", "Content-Type": "application/json" },
        body: method === "POST" ? "{}" : undefined,
      });
      expect(response.status, path).toBe(404);
      expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
    }
  });

  it("keeps performance fixture registration and removal owner-only", async () => {
    const app = createApp({ remoteAccess: { ownerToken: "test-owner", token: "test-remote" } });
    for (const [method, path] of [
      ["POST", "/api/projects"],
      ["DELETE", "/api/projects/zz-probe-nonexistent"],
    ]) {
      const response = await app.request(path!, {
        method,
        headers: { Authorization: "Bearer test-remote" },
      });
      expect(response.status).toBe(401);
    }
  });
  it.each<CreateAppOptions>([
    {},
    {
      remoteAccess: {
        bindHostname: "127.0.0.1",
        token: "test-remote",
        localBypassToken: "test-owner",
        ownerToken: "test-owner",
      },
    },
    { remoteAccess: { bindHostname: "0.0.0.0", token: "test-remote" } },
  ])("refuses a mutation without credentials on every bind: %j", async (options) => {
    const response = await createApp(options).request("/api/project/zz-probe-nonexistent/send", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ target: "zz-probe-pane", message: "true", noEnter: true }),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Remote access token required" });
  });
});
