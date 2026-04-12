import { describe, expect, it } from "vitest";
import { ac, accessControlStatement } from "../permissions.js";

describe("accessControlStatement", () => {
  it("defines all expected resources with non-empty action lists", () => {
    const expectedResources = [
      "organization",
      "member",
      "invitation",
      "contractor",
      "contract",
      "document",
      "invoice",
      "workflow",
      "payment",
      "report",
      "settings",
      "integration",
      "time",
      "equipment",
    ];
    const keys = Object.keys(accessControlStatement);
    expect(keys).toHaveLength(expectedResources.length);
    for (const resource of expectedResources) {
      expect(keys, `missing resource: ${resource}`).toContain(resource);
    }
    for (const k of keys) {
      const actions = accessControlStatement[k as keyof typeof accessControlStatement];
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    }
  });

  it("creates an access control instance from the statement", () => {
    expect(ac).toBeDefined();
    expect(ac.newRole).toBeTypeOf("function");
  });
});
