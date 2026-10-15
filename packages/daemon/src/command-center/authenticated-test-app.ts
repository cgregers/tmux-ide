import { createApp, type CreateAppOptions } from "./server.ts";

/** Domain-route fixtures still exercise the production gate with a held bearer. */
export function createAuthenticatedTestApp(options: CreateAppOptions = {}) {
  const ownerToken = options.remoteAccess?.ownerToken ?? "test-domain-owner";
  const app = createApp({
    ...options,
    remoteAccess: { ...options.remoteAccess, ownerToken },
  });
  const request = app.request.bind(app);
  app.request = (input, init, ...rest) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${ownerToken}`);
    const authenticated =
      input instanceof Request ? new Request(input, { ...init, headers }) : input;
    return request(authenticated, { ...init, headers }, ...rest);
  };
  return app;
}
