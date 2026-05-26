import { expect, test } from '@playwright/test';

import {
  E2E_LOCALE,
  expectPageHeading,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Contractors list smoke — Step 13 port from apps/web/e2e/functional/contractors.spec.ts
 * Routes: /:locale/contractors (Vite SPA, default locale pl).
 */
test.describe('Contractors page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, `/${E2E_LOCALE}/contractors`);
    skipIfUnauthenticated(page);
  });

  test('page renders with main content', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /kontrahent|contractor/i);
  });

  test('table or empty state is visible', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyState = page
      .locator('[data-testid="empty-state"], [class*="empty"], .flex.flex-col.items-center')
      .filter({ has: page.locator('button') })
      .first();

    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('search input is present', async ({ page }) => {
    const searchInput = page
      .locator(
        'input[placeholder*="zuk"], input[placeholder*="earch"], input[type="search"], input[aria-label*="earch"]',
      )
      .first();
    await expect(searchInput).toBeVisible({ timeout: 15_000 });
  });

  test('add contractor button exists', async ({ page }) => {
    const addButton = page
      .locator('button')
      .filter({ hasText: /dodaj|add|new|\+/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 15_000 });
  });

  test('table rows are clickable and open side panel', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count().catch(() => 0);

    test.skip(rowCount === 0, 'No data rows in table — skipping click test.');

    await rows.first().click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 15_000 });
  });

  test('URL action=new opens wizard', async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/contractors?action=new`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) return;

    const dialog = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [data-state="open"].sheet-content, [role="dialog"]',
      )
      .first();
    await expect(dialog).toBeVisible({ timeout: 20_000 });
  });

  test('search retains typed value', async ({ page }) => {
    const searchInput = page
      .locator(
        'input[placeholder*="zuk"], input[placeholder*="earch"], input[type="search"], input[aria-label*="earch"]',
      )
      .first();
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill('test-query');

    await page.waitForURL(/search=test-query/, { timeout: 10_000 }).catch(() => {
      // Some implementations filter client-side without URL params — acceptable
    });

    await expect(searchInput).toHaveValue('test-query');
  });
});
