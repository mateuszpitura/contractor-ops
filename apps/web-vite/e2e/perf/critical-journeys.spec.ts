import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { E2E_LOCALE, skipIfUnauthenticated } from '../functional/helpers';

/**
 * Authenticated dashboard shell perf — ported from
 * apps/web/e2e/perf/critical-journeys.spec.ts. The Vite SPA uses `/<locale>`
 * as the dashboard index (no `/dashboard` or `/v2` segment).
 *
 * Perf config does not wire `globalSetup`, so without a session the page
 * lands on `/login` and `skipIfUnauthenticated` skips the test.
 */
async function measureShell(page: Page, path: string, _scenario: string) {
  const t0 = Date.now();
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  skipIfUnauthenticated(page);
  await page.locator('#main-content').waitFor({ state: 'visible', timeout: 60_000 });
  const durationMs = Date.now() - t0;
  expect(durationMs).toBeLessThan(120_000);
}

test.describe('perf — authenticated shell', () => {
  test('dashboard home', async ({ page }) => {
    await measureShell(page, `/${E2E_LOCALE}`, 'dashboard');
  });

  test('contractors list', async ({ page }) => {
    await measureShell(page, `/${E2E_LOCALE}/contractors`, 'contractors');
  });

  test('invoices list', async ({ page }) => {
    await measureShell(page, `/${E2E_LOCALE}/invoices`, 'invoices');
  });

  test('approvals queue', async ({ page }) => {
    await measureShell(page, `/${E2E_LOCALE}/approvals`, 'approvals');
  });
});
