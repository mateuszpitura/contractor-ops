/**
 * Performance / Web Vitals E2E tests against the new Vite + Fastify stack.
 *
 * Runs Lighthouse + Web Vitals capture against the same dashboard routes
 * the legacy apps/web perf suite covered. Reuses the integration webServer
 * shape (api on :4000, SPA preview on :4173) but with a smaller worker
 * count + longer timeouts so Lighthouse runs don't compete with each
 * other for CPU.
 */

import { defineConfig, devices } from '@playwright/test';

const SPA_PORT = Number(process.env.WEB_VITE_PORT ?? 4173);
const API_PORT = Number(process.env.API_SERVER_PORT ?? 4000);

export default defineConfig({
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-perf' }]],
  timeout: 180_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${SPA_PORT}`,
    ...devices['Desktop Chrome'],
    trace: 'off',
    screenshot: 'off',
  },

  webServer: [
    {
      command: `pnpm --filter @contractor-ops/api-server start`,
      port: API_PORT,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'production',
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
      name: 'perf',
      testDir: './e2e/perf',
      testMatch: '**/*.spec.ts',
    },
  ],
});
