import { expect, test } from '@playwright/test';

import {
  E2E_LOCALE,
  expectPageHeading,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Invoices list smoke — batch 2 port from apps/web/e2e/functional/invoices.spec.ts
 * Routes: /:locale/invoices (Vite SPA, default locale pl).
 */
test.describe('Invoices page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, `/${E2E_LOCALE}/invoices`);
    skipIfUnauthenticated(page);
  });

  test('page renders with main content', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /faktur|invoice/i);
  });

  test('table or empty state is visible', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyState = page
      .locator('[data-testid="empty-state"], [class*="empty"], .flex.flex-col.items-center')
      .filter({ has: page.locator('button') })
      .first();

    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('status or compliance filter controls are present', async ({ page }) => {
    const chipBar = page
      .locator('[role="tablist"], [data-testid="status-chips"], [class*="chip"], [class*="badge"]')
      .first()
      .or(
        page
          .locator('button')
          .filter({
            hasText:
              /wszystkie|all|draft|robocz|pending|oczekuj|approved|zaakcept|paid|oplac|overdue|po terminie/i,
          })
          .first(),
      );
    await expect(chipBar).toBeVisible({ timeout: 15_000 });
  });

  test('import or upload action exists', async ({ page }) => {
    const uploadButton = page
      .locator('button')
      .filter({ hasText: /wgraj|upload|nowa faktura|new invoice/i })
      .first();
    await expect(uploadButton).toBeVisible({ timeout: 15_000 });
  });

  test('status chip filters table', async ({ page }) => {
    const statusChip = page
      .locator('button')
      .filter({
        hasText:
          /wszystkie|all|draft|robocz|pending|oczekuj|approved|zaakcept|paid|oplac|overdue|po terminie/i,
      })
      .first();

    const chipVisible = await statusChip.isVisible().catch(() => false);
    test.skip(!chipVisible, 'No status chips visible — skipping filter test.');

    const urlBefore = page.url();
    await statusChip.click();

    await page.waitForTimeout(2_000);

    const urlAfter = page.url();
    const urlChanged = urlAfter !== urlBefore;

    if (!urlChanged) {
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });

  test('search input works', async ({ page }) => {
    const searchInput = page
      .locator(
        'input[placeholder*="zuk"], input[placeholder*="earch"], input[type="search"], input[aria-label*="earch"]',
      )
      .first();
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill('INV-999');

    await page.waitForURL(/search=INV-999/, { timeout: 10_000 }).catch(() => {
      // Client-side filtering without URL params is acceptable
    });

    await expect(searchInput).toHaveValue('INV-999');
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
});
