import { defineConfig } from "vitest/config";

import { vitestProject } from "../../vitest.monorepo";

export default defineConfig({
  test: {
    name: vitestProject.govApi.name,
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    sequence: { groupOrder: vitestProject.govApi.groupOrder },
  },
});
