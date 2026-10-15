import { describe, expect, it } from "vitest";
import { router } from "@/router";
import { tools } from "@/tools";

describe("router", () => {
  it("has a route for every tool on the home page", () => {
    for (const tool of tools) {
      expect(router.routesByPath).toHaveProperty([tool.to]);
    }
  });

  it("has the home page", () => {
    expect(router.routesByPath).toHaveProperty(["/"]);
  });
});
