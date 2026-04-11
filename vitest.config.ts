import { defineConfig } from "vitest/config";

/**
 * Monorepo workspace: one `vitest run --coverage` merges coverage across packages.
 * Use `pnpm test:coverage` from the repo root.
 *
 * Vitest version: keep `vitest` and `@vitest/coverage-v8` on the same major/minor in root
 * `package.json` (current stable is 4.1.x per npm `latest`).
 *
 * Project labels and run order (`sequence.groupOrder`) live in `vitest.monorepo.ts`.
 *
 * `coverage.include` = every matching source file counts toward the denominator, even if never
 * imported during tests (0% lines). That is the “honest” % vs only tracking executed modules.
 */
export default defineConfig({
  test: {
    projects: [
      "apps/web",
      "packages/api",
      "packages/auth",
      "packages/db",
      "packages/integrations",
      "packages/logger",
      "packages/validators",
      "packages/einvoice",
      "packages/gov-api",
      /** Test-only harness (MSW, fixtures) — not in root coverage; run via `pnpm --filter @contractor-ops/test-utils test` */
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: [
        "apps/web/src/**/*.{ts,tsx}",
        "packages/api/src/**/*.ts",
        "packages/auth/src/**/*.ts",
        "packages/db/src/**/*.ts",
        "packages/integrations/src/**/*.ts",
        "packages/logger/src/**/*.ts",
        "packages/validators/src/**/*.ts",
        "packages/gov-api/src/**/*.ts",
      ],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/coverage/**",
        "**/.turbo/**",
        /** Prisma-generated client + default engine output — not our code to cover */
        "**/generated/**",
        "**/.prisma/**",
        /** MSW/fixtures package — imported only from tests; exclude if traced into other projects */
        "**/packages/test-utils/**",
        "**/*.d.ts",
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        /** RTL / Vitest harness (not app features) */
        "apps/web/src/test/**",
      ],
    },
  },
});
