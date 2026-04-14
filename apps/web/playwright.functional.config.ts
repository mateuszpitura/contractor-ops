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
  testDir: './e2e/functional',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: './e2e/functional/global-setup.ts',
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    ...devices['Desktop Chrome'],
    storageState: authFile,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
