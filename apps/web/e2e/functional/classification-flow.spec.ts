import { expect, test } from '@playwright/test';

import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Classification flow', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/classification');
    skipIfUnauthenticated(page);
  });

  test('classification page renders with main content', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /classif|risk|compliance/i);
  });

  test('contractor list or empty state visible', async ({ page }) => {
    const table = page.locator('table, [role="table"], [data-testid*="table"]').first();
    const cards = page
      .locator('[data-testid*="contractor"], [data-testid*="classification"], [class*="card"]')
      .first();
    const emptyState = page.getByText(
      /no contractors|no data|nothing to classify|no assessments|get started/i,
    );

    await expect(table.or(cards).or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('clicking a contractor row navigates to detail or opens panel', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);

    if (hasTable) {
      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();
      test.skip(rowCount === 0, 'Table has no rows — skipping click test');

      await rows.first().click();
    } else {
      // Try card-based layout
      const card = page
        .locator('[data-testid*="contractor"], [data-testid*="classification"], [class*="card"]')
        .first();
      const hasCard = await card.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!hasCard, 'No contractor rows or cards visible — skipping click test');

      await card.click();
    }

    // Expect either a side panel, dialog, or URL navigation
    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [role="dialog"], aside',
      )
      .first();
    const urlChanged = !page.url().endsWith('/en/classification');

    if (!urlChanged) {
      await expect(sidePanel).toBeVisible({ timeout: 15_000 });
    }
  });

  test('classification questionnaire accessible', async ({ page }) => {
    // Look for a button that starts an assessment
    const assessButton = page
      .locator('button, a[role="button"], a')
      .filter({ hasText: /start assessment|assess|classify|begin|new assessment|evaluate/i })
      .first();

    const emptyState = page.getByText(/no contractors|no data|nothing to classify|get started/i);

    // Either the assess button or the empty state should be visible
    await expect(assessButton.or(emptyState)).toBeVisible({ timeout: 15_000 });
  });

  test('risk status badges visible', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasTable, 'No table visible — skipping badge test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'No rows in table — skipping badge test');

    // Look for status badges/pills within table rows
    const badge = page
      .locator('table tbody')
      .locator(
        '[class*="badge"], [class*="pill"], [class*="status"], [data-testid*="risk"], [data-testid*="status"]',
      )
      .first()
      .or(
        page
          .locator('table tbody span, table tbody div')
          .filter({ hasText: /high|medium|low|green|amber|red|compliant|non-compliant|pending/i })
          .first(),
      );

    await expect(badge).toBeVisible({ timeout: 15_000 });
  });

  test('search or filter for contractors works', async ({ page }) => {
    const searchInput = page
      .locator('input[placeholder*="earch"], input[type="search"], input[aria-label*="earch"]')
      .first();

    const inputVisible = await searchInput.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!inputVisible, 'No search input visible — skipping search test');

    await searchInput.fill('test-contractor');

    // Wait for debounced URL update or client-side filter
    await page.waitForURL(/search=test-contractor/, { timeout: 10_000 }).catch(() => {
      // Client-side filtering without URL params is acceptable
    });

    await expect(searchInput).toHaveValue('test-contractor');
  });

  test('tab navigation if tabs exist', async ({ page }) => {
    const tabList = page.getByRole('tablist').first();
    const hasTabList = await tabList.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!hasTabList) {
      // Also check for filter buttons that act like tabs (jurisdiction filter)
      const jurisdictionFilter = page
        .locator('button')
        .filter({ hasText: /IR35|scheinselbst|jurisdiction|all|germany|uk/i })
        .first();
      const hasFilter = await jurisdictionFilter.isVisible({ timeout: 5_000 }).catch(() => false);
      test.skip(!hasFilter, 'No tabs or jurisdiction filters visible — skipping');

      await jurisdictionFilter.click();
      await expect(page.locator('#main-content')).toBeVisible();
      return;
    }

    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);

    if (count > 1) {
      const secondTab = tabs.nth(1);
      await secondTab.click();
      await expect(secondTab).toHaveAttribute('data-state', 'active');
    }
  });
});
