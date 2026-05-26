/**
 * Integration E2E tests against the new Vite + Fastify stack.
 *
 * Differs from playwright.functional.config.ts only in testDir/project
 * name — specs live in e2e/integration and exercise tRPC + Better Auth
 * end-to-end paths (login, contractor CRUD, invoice intake).
 *
 * webServer set is identical: starts apps/api on :4000 and the vite
 * preview build on :4173 so the suite owns the stack lifecycle.
 */

import { defineConfig, devices } from '@playwright/test';

const SPA_PORT = Number(process.env.WEB_VITE_PORT ?? 4173);
const API_PORT = Number(process.env.API_SERVER_PORT ?? 4000);

export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-integration' }]],
  timeout: 120_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${SPA_PORT}`,
    ...devices['Desktop Chrome'],
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
      name: 'integration',
      testDir: './e2e/integration',
      testMatch: '**/*.spec.ts',
    },
  ],
});
