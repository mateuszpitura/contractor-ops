import { expect, test } from '@playwright/test';
import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Time Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/time');
    skipIfUnauthenticated(page);
  });

  test('time tracking page renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /time/i);
  });

  test('tabs exist', async ({ page }) => {
    const tabTrigger = page.locator('[role="tab"]').first();
    const tabList = page.locator('[role="tablist"]').first();

    await expect(tabTrigger.or(tabList)).toBeVisible({ timeout: 15_000 });
  });

  test('table or empty state visible', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyState = page
      .locator('[data-testid*="empty"], p, div')
      .filter({ hasText: /no (time|entries|records)|empty|get started/i })
      .first();

    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('tab switching works', async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    test.skip(tabCount < 2, 'Less than 2 tabs — skipping tab switch test');

    const firstTab = tabs.first();
    const secondTab = tabs.nth(1);

    // Click the second tab
    await secondTab.click();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true', {
      timeout: 10_000,
    });

    // Click back to first tab and verify it becomes active
    await firstTab.click();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true', {
      timeout: 10_000,
    });
  });
});
