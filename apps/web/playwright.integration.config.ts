import { defineConfig, devices } from "@playwright/test";

/**
 * HTTP + browser smoke (Resend webhook optional, public routes always-on).
 * - Public: `pnpm e2e:integration` (needs dev server; `E2E_WEB_URL` overrides base URL).
 * - Resend webhook: `RUN_RESEND_E2E=1` plus same server.
 */
export default defineConfig({
  testDir: "./e2e/integration",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
