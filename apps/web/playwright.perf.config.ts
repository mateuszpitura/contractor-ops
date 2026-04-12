import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const authFile = path.join(process.cwd(), "e2e/perf/.auth/user.json");

export default defineConfig({
  testDir: "./e2e/perf",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: "./e2e/perf/global-setup.ts",
  reporter: [["list"], ["json", { outputFile: "e2e/perf/results/perf-results.json" }]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ...devices["Desktop Chrome"],
    storageState: authFile,
    trace: "on-first-retry",
  },
});
