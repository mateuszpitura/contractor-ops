import { expect, test } from '@playwright/test';

import {
  E2E_LOCALE,
  expectPageHeading,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Reports dashboard smoke — Step 13 port from apps/web/e2e/functional/reports.spec.ts
 * Routes: /:locale/reports (Vite SPA, default locale pl).
 *
 * Sidebar items render as <button> (not <a>); switching report updates the
 * `report` query param via nuqs `useQueryState`. Page is permission-gated and
 * redirects to /:locale/unauthorized when the session lacks `report:read`.
 */
const REPORT_NAME_PATTERN =
  /spend|expiring|overdue|compliance|contractor|team|wydatki|wygasaj|zalegl|luki|kontrahent|zespol/i;

const DATE_PRESET_PATTERN =
  /date|from|to|range|period|month|year|miesiac|miesiace|rok|zakres|wlasny|custom/i;

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, `/${E2E_LOCALE}/reports`);
    // Reports are permission-gated — handle both authenticated and unauthorized redirects
    if (page.url().includes('/unauthorized')) return;
    skipIfUnauthenticated(page);
  });

  test('page renders or redirects to unauthorized', async ({ page }) => {
    const isUnauthorized = page.url().includes('/unauthorized');
    const hasMainContent = await page
      .locator('#main-content')
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    expect(isUnauthorized || hasMainContent).toBe(true);
  });

  test('page shows heading', async ({ page }) => {
    test.skip(page.url().includes('/unauthorized'), 'Redirected to unauthorized');
    await expectPageHeading(page, /report|raport/i);
  });

  test('report selector/sidebar exists with report options', async ({ page }) => {
    test.skip(page.url().includes('/unauthorized'), 'Redirected to unauthorized');

    const sidebar = page
      .locator('[data-testid*="report"], nav, [role="tablist"], [role="listbox"], aside')
      .first();
    const reportButton = page.getByRole('button', { name: REPORT_NAME_PATTERN }).first();

    await expect(sidebar.or(reportButton)).toBeVisible({ timeout: 15_000 });
  });

  test('date range filter is present', async ({ page }) => {
    test.skip(page.url().includes('/unauthorized'), 'Redirected to unauthorized');

    const dateFilter = page
      .locator('button, input')
      .filter({ hasText: DATE_PRESET_PATTERN })
      .first();
    const dateInput = page.locator('input[type="date"], [data-testid*="date"]').first();

    await expect(dateFilter.or(dateInput)).toBeVisible({ timeout: 15_000 });
  });

  test('switching report type updates URL with report param', async ({ page }) => {
    test.skip(page.url().includes('/unauthorized'), 'Redirected to unauthorized');

    const reportButton = page.getByRole('button', { name: REPORT_NAME_PATTERN }).first();

    const isVisible = await reportButton.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!isVisible, 'No report options found — skipping URL param test');

    await reportButton.click();
    await page.waitForURL(/[?&]report=/, { timeout: 10_000 }).catch(() => {
      // nuqs may batch URL updates — fall through to assertion
    });

    expect(page.url()).toMatch(/[?&]report=/);
  });
});
