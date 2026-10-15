import { test } from "node:test";
import assert from "node:assert/strict";
import { createOnFleetRoute } from "./fleet-server-create.ts";

test("create checks captured presence and route again after deferred verification, without retry", async () => {
  for (const mutation of [
    "none",
    "background",
    "foreground-cycle",
    "navigation",
    "endpoint",
  ] as const) {
    let resume!: () => void;
    let foreground = true,
      presence = 1,
      request = 1,
      valid = true,
      effects = 0;
    const route = {
      read: () =>
        new Promise<void>((resolve) => {
          resume = resolve;
        }),
      assertCurrent() {
        if (!valid) throw new Error("Server selection changed");
      },
    };
    const pending = createOnFleetRoute(
      route,
      () => foreground && presence === 1 && request === 1,
      async () => ++effects,
    );
    if (mutation === "background") {
      foreground = false;
      presence++;
    }
    if (mutation === "foreground-cycle") {
      foreground = true;
      presence += 2;
    }
    if (mutation === "navigation") request++;
    if (mutation === "endpoint") valid = false;
    resume();
    if (mutation === "none") assert.equal(await pending, 1);
    else await assert.rejects(pending, /changed/);
    assert.equal(effects, mutation === "none" ? 1 : 0, mutation);
  }
});
