import { describe, expect, it } from "vitest";

import { createMissingDatabaseUrlProxy } from "../client.js";

describe("createMissingDatabaseUrlProxy", () => {
  it("throws when any model or property is accessed", () => {
    const proxy = createMissingDatabaseUrlProxy();
    expect(() => {
      void proxy.notification;
    }).toThrow(/DATABASE_URL environment variable is not set/);
  });
});
