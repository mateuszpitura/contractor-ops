/**
 * Functional E2E tests against the new Vite + Fastify stack.
 *
 * Mirrors apps/web/playwright.functional.config.ts but starts:
 *   - apps/api on :4000 (Fastify API)
 *   - apps/web-vite preview on :4173 (built SPA)
 *
 * Specs themselves live in `e2e/` and are batch-ported from
 * apps/web/e2e/functional/ alongside the page ports in plan.md Step 10.
 * Until a batch is ported, its spec stays in apps/web/ and runs against
 * the legacy stack via `pnpm --filter @contractor-ops/web e2e:functional`.
 */

import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const SPA_PORT = Number(process.env.WEB_VITE_PORT ?? 4173);
const API_PORT = Number(process.env.API_SERVER_PORT ?? 4000);
const authFile = path.join(process.cwd(), 'e2e/functional/.auth/user.json');

export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: './e2e/functional/global-setup.ts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${SPA_PORT}`,
    ...devices['Desktop Chrome'],
    storageState: authFile,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Boot the SPA preview + the Fastify API in parallel so the test run
  // owns the stack lifecycle. The waitForUrl probes give each server a
  // generous window since cold starts on a fresh node_modules can take
  // > 10 s.
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
      name: 'functional',
      testDir: './e2e/functional',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'a11y',
      testDir: './e2e/a11y',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
