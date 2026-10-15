import { expect, it, vi } from "vitest";
import { SessionRuntimeRegistry } from "./registry.ts";
import { MirrorService } from "../mirror/mirror-service.ts";
const generation = "11111111-1111-4111-8111-111111111111";
it("surrenders an exact controller lease during topology verification without granting a successor", async () => {
  const registry = new SessionRuntimeRegistry({ generation });
  const owner = registry.connect("proof", "web", "client:owner");
  const next = registry.connect("proof", "web", "client:next");
  const lease = owner.acquireController();
  const geometry = owner.acquireAuthority("geometry")!;
  const topology = vi
    .spyOn(MirrorService.prototype, "windowOwnershipMessage")
    .mockReturnValue("Window ownership is being verified");
  try {
    expect(() => next.acquireController()).toThrow(
      expect.objectContaining({ code: "controller-conflict" }),
    );
    expect(() => owner.assertGeometryAuthority(geometry)).toThrow(
      expect.objectContaining({ code: "controller-conflict" }),
    );
    expect(() => owner.releaseController(lease)).not.toThrow();
    expect(owner.controllerSnapshot().controllerClientId).toBeNull();
    expect(owner.authoritySnapshot().owners.input).toBeNull();
    expect(owner.authoritySnapshot().owners.geometry).toBeNull();
    expect(() => next.acquireController()).toThrow(
      expect.objectContaining({ code: "controller-conflict" }),
    );
    topology.mockReturnValue(null);
    const replacement = next.acquireController();
    expect(replacement.clientId).toBe("client:next");
    owner.releaseController(lease);
    expect(next.controllerSnapshot().controllerClientId).toBe("client:next");
  } finally {
    topology.mockRestore();
    await registry.dispose();
  }
});
it("topology unavailability never permits a foreign, forged or stale lease to release ownership", async () => {
  const registry = new SessionRuntimeRegistry({ generation });
  const owner = registry.connect("proof", "web", "client:owner");
  const other = registry.connect("proof", "web", "client:other");
  const lease = owner.acquireController();
  const topology = vi
    .spyOn(MirrorService.prototype, "windowOwnershipMessage")
    .mockReturnValue("Shared window conflict");
  try {
    for (const candidate of [
      { ...lease, token: "22222222-2222-4222-8222-222222222222" },
      { ...lease, revision: lease.revision + 1 },
      { ...lease, session: "other" },
    ])
      expect(() => owner.releaseController(candidate)).toThrow();
    expect(() => other.releaseController(lease)).toThrow();
    expect(owner.controllerSnapshot().controllerClientId).toBe("client:owner");
    expect(() => owner.acquireAuthority("input")).toThrow(
      expect.objectContaining({ code: "controller-conflict" }),
    );
    owner.releaseController(lease);
    expect(owner.controllerSnapshot().controllerClientId).toBeNull();
  } finally {
    topology.mockRestore();
    await registry.dispose();
  }
});
