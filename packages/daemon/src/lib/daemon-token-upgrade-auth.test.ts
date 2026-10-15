import { expect, it } from "vitest";
import { isUpgradeAuthorized } from "./daemon-embed.ts";

it("accepts a daemon query credential alongside a project JWT header", () => {
  const request = {
    headers: { authorization: "Bearer project.jwt.signature" },
    url: "/ws/events?token=test-owner",
  };
  expect(isUpgradeAuthorized(request, "test-remote", "test-bypass", "test-owner")).toBe(true);
  expect(isUpgradeAuthorized(request, null, null, "test-owner")).toBe(true);
});

it.each(["test-owner", "test-bypass", "test-remote"])(
  "authenticates %s from either channel without expanding owner rights",
  (token) => {
    for (const request of [
      { headers: { authorization: `Bearer ${token}` }, url: "/ws/events" },
      { headers: {}, url: `/ws/events?token=${token}` },
      {
        headers: { authorization: "Bearer project.jwt.signature" },
        url: `/ws/events?token=${token}`,
      },
      {
        headers: { authorization: `Bearer ${token}` },
        url: "/ws/events?token=wrong",
      },
    ]) {
      expect(isUpgradeAuthorized(request, "test-remote", "test-bypass", "test-owner")).toBe(true);
      // This owner-only invocation is also used by /ws/events admission.
      expect(isUpgradeAuthorized(request, null, null, "test-owner")).toBe(token === "test-owner");
      expect(isUpgradeAuthorized(request, null, null, null)).toBe(false);
      expect(isUpgradeAuthorized(request, undefined, undefined, undefined)).toBe(false);
    }
  },
);

it.each([
  { headers: {}, url: "/ws/events" },
  { headers: { authorization: "Bearer x" }, url: "/ws/events?token=wrong" },
  {
    headers: { authorization: "Bearer project.jwt.signature" },
    url: "/ws/events?token=wrong-with-more-bytes",
  },
  { headers: { authorization: "Bearer " }, url: "/ws/events?token=" },
  { headers: { authorization: "Basic test-owner" }, url: "/ws/events" },
])("rejects missing, invalid or wrong-length WS candidates: %j", (request) => {
  expect(isUpgradeAuthorized(request, "test-remote", "test-bypass", "test-owner")).toBe(false);
  expect(isUpgradeAuthorized(request, null, null, "test-owner")).toBe(false);
});

it("retains a valid header candidate when the query URL is malformed", () => {
  const request = { headers: { authorization: "Bearer test-owner" }, url: "http://[" };
  expect(isUpgradeAuthorized(request, null, null, "test-owner")).toBe(true);
});
