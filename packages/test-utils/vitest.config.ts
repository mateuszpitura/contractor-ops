import { defineConfig } from "vitest/config";

import { vitestProject } from "../../vitest.monorepo";

export default defineConfig({
  test: {
    name: vitestProject.testUtils.name,
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    passWithNoTests: true,
    sequence: { groupOrder: vitestProject.testUtils.groupOrder },
  },
});
