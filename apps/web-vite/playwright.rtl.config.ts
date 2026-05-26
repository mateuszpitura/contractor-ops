/**
 * RTL (Arabic) E2E tests against the new Vite + Fastify stack.
 *
 * Visits dashboard / portal / settings routes under the `ar` locale and
 * asserts `<html dir="rtl">` plus per-component bidirectional layout.
 * i18n bootstrap in src/i18n/index.ts owns the dir toggle on every
 * locale change — these specs are the regression gate.
 */

import { defineConfig, devices } from '@playwright/test';

const SPA_PORT = Number(process.env.WEB_VITE_PORT ?? 4173);
const API_PORT = Number(process.env.API_SERVER_PORT ?? 4000);

export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-rtl' }]],
  timeout: 60_000,

  use: {
    // RTL specs land on /ar/* directly; the locale loader flips
    // <html dir="rtl"> before the first paint.
    baseURL: `${process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${SPA_PORT}`}/ar`,
    ...devices['Desktop Chrome'],
    locale: 'ar',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: [
    {
      command: `pnpm --filter @contractor-ops/api-server start`,
      port: API_PORT,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        HOST: '127.0.0.1',
        APP_URL: `http://localhost:${SPA_PORT}`,
        API_URL: `http://localhost:${API_PORT}`,
      },
    },
    {
      command: `pnpm --filter @contractor-ops/web-vite preview --port ${SPA_PORT} --strictPort`,
      port: SPA_PORT,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: `http://localhost:${API_PORT}`,
        VITE_APP_URL: `http://localhost:${SPA_PORT}`,
      },
    },
  ],

  projects: [
    {
      name: 'rtl',
      testDir: './e2e/rtl',
      testMatch: '**/*.spec.ts',
    },
  ],
});
