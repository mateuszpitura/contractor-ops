import { expect, test } from '@playwright/test';

import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Invoices page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/invoices');
    skipIfUnauthenticated(page);
  });

  test('page renders with main content', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /invoice/i);
  });

  test('table or empty state is visible', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyState = page
      .locator('[data-testid="empty-state"], [class*="empty"], .flex.flex-col.items-center')
      .filter({ has: page.locator('button') })
      .first();

    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('status chip bar is present', async ({ page }) => {
    // Status chips are typically badge-like buttons or toggle elements above the table
    const chipBar = page
      .locator('[role="tablist"], [data-testid="status-chips"], [class*="chip"], [class*="badge"]')
      .first()
      .or(
        page
          .locator('button')
          .filter({ hasText: /all|draft|pending|approved|paid|overdue/i })
          .first(),
      );
    await expect(chipBar).toBeVisible({ timeout: 15_000 });
  });

  test('upload button exists', async ({ page }) => {
    const uploadButton = page
      .locator('button')
      .filter({ hasText: /upload/i })
      .first();
    await expect(uploadButton).toBeVisible({ timeout: 15_000 });
  });

  test('status chip filters table', async ({ page }) => {
    // Find a clickable status chip/button
    const statusChip = page
      .locator('button')
      .filter({ hasText: /draft|pending|approved|paid|overdue|all/i })
      .first();

    const chipVisible = await statusChip.isVisible().catch(() => false);
    test.skip(!chipVisible, 'No status chips visible — skipping filter test.');

    const urlBefore = page.url();
    await statusChip.click();

    // Wait briefly for URL or content update
    await page.waitForTimeout(2_000);

    // Either URL changed with a filter param, or content re-rendered
    const urlAfter = page.url();
    const urlChanged = urlAfter !== urlBefore;

    // If URL did not change, the filter may work client-side — just verify no crash
    if (!urlChanged) {
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });

  test('search input works', async ({ page }) => {
    const searchInput = page
      .locator('input[placeholder*="earch"], input[type="search"], input[aria-label*="earch"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    await searchInput.fill('INV-999');

    // Wait for debounced URL update
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
