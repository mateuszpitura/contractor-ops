import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Phase 50 RTL / Arabic localization tests.
 *
 * Tests cover L10N-01 through L10N-04:
 *   - RTL layout rendering (dir="rtl", sidebar position)
 *   - Bidi text isolation (<bdi> element presence)
 *   - Chart axis mirroring in Arabic locale
 *   - Locale switcher cycling (pl -> en -> ar -> pl)
 *
 * Public tests (L10N-02 basic, L10N-03 DOM) run without credentials.
 * Authenticated tests skip gracefully when E2E_EMAIL / E2E_PASSWORD are unset.
 *
 * Run: pnpm --filter web e2e:rtl
 * Requires a running dev or preview server (default: http://127.0.0.1:3000).
 * Override base URL via E2E_WEB_URL env var.
 */
export default defineConfig({
  testDir: "./e2e/rtl",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
