import { defineConfig } from "vitest/config";

import { vitestProject } from "../../vitest.monorepo";

export default defineConfig({
  test: {
    name: vitestProject.db.name,
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    sequence: { groupOrder: vitestProject.db.groupOrder },
    coverage: {
      provider: "v8",
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        /** `prisma generate` output — exclude from metrics (external-generated surface) */
        "**/generated/**",
        "**/.prisma/**",
      ],
    },
  },
});
