import type { Hono } from "hono";
import {
  PaneEditorContextResponseSchemaZ,
  PaneEditorContextTargetSchemaZ,
  TmuxServerScopeSchemaZ,
} from "@tmux-ide/contracts";
import { TmuxServerScopeError, type TmuxServerOwners } from "../lib/tmux-server-owners.ts";
import type { NativeTmuxServerOwner } from "../lib/tmux-server-owner.ts";

/** Mount only below the enclosing owner-authenticated, no-store scoped router. */
export function mountTmuxServerEditorContextRoute(
  app: Hono,
  options: {
    readonly scopedPath: string;
    readonly owners: TmuxServerOwners<NativeTmuxServerOwner>;
    readonly readBody: (request: Request) => Promise<unknown>;
  },
): void {
  app.post(`${options.scopedPath}/pane-editor-context`, async (c) => {
    const scope = TmuxServerScopeSchemaZ.safeParse({
      serverId: c.req.param("serverId"),
      generation: c.req.param("generation"),
    });
    if (!scope.success) return c.json({ error: { code: "invalid-request" } }, 400);
    let body: unknown;
    try {
      body = await options.readBody(c.req.raw);
    } catch {
      return c.json({ error: { code: "invalid-request" } }, 400);
    }
    const target = PaneEditorContextTargetSchemaZ.safeParse(body);
    if (!target.success) return c.json({ error: { code: "invalid-request" } }, 400);
    if (target.data.generation !== scope.data.generation)
      return c.json({ error: { code: "stale-generation" } }, 409);
    try {
      c.req.raw.signal.throwIfAborted();
      const context = await options.owners.withOwner(scope.data, (owner) =>
        owner.resolvePaneEditorContext(target.data, c.req.raw.signal),
      );
      c.req.raw.signal.throwIfAborted();
      const response = PaneEditorContextResponseSchemaZ.safeParse({
        version: 1,
        server: scope.data,
        context,
      });
      if (
        !response.success ||
        Object.entries(target.data).some(
          ([key, value]) => context[key as keyof typeof target.data] !== value,
        )
      )
        throw new Error("Invalid editor context observation");
      return c.json(response.data);
    } catch (error) {
      // Never serialize cwd, filesystem errors, raw owner messages or validation issues.
      if (error instanceof TmuxServerScopeError)
        return c.json(
          { error: { code: "scope-unavailable" } },
          error.code === "not-found" ? 404 : 409,
        );
      return c.json({ error: { code: "editor-context-unavailable" } }, 503);
    }
  });
}
