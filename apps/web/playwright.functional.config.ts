import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const authFile = path.join(process.cwd(), 'e2e/functional/.auth/user.json');

/**
 * Functional E2E tests — critical user journey coverage.
 *
 * Run: pnpm e2e:functional
 * Prerequisites: E2E_EMAIL + E2E_PASSWORD for authenticated flows
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: './e2e/functional/global-setup.ts',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 60_000,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ...devices['Desktop Chrome'],
    storageState: authFile,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'functional',
      testDir: './e2e/functional',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // C.4.a — axe-core WCAG 2.2 AA gate against the top-10 dashboard routes.
      // Reuses the functional auth fixture (storageState from global-setup) so
      // gated routes render in their authenticated shape; specs auto-skip
      // gracefully when E2E_EMAIL / E2E_PASSWORD are unset.
      name: 'a11y',
      testDir: './e2e/a11y',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
