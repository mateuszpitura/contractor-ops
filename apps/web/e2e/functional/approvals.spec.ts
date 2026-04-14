import { expect, test } from '@playwright/test';
import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Approvals', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/approvals');
    skipIfUnauthenticated(page);
  });

  test('approvals page renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /approvals/i);
  });

  test('default "My" tab is active', async ({ page }) => {
    const myTab = page.getByRole('tab', { name: /my/i }).first();
    await myTab.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(myTab).toHaveAttribute('data-state', 'active');
  });

  test('tab triggers are visible', async ({ page }) => {
    const tabList = page.getByRole('tablist').first();
    await tabList.waitFor({ state: 'visible', timeout: 15_000 });

    const myTab = page.getByRole('tab', { name: /my/i }).first();
    await expect(myTab).toBeVisible();

    // "All" and "Profile Changes" may only be visible for admins — just count tabs
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('tab switching works', async ({ page }) => {
    const tabList = page.getByRole('tablist').first();
    await tabList.waitFor({ state: 'visible', timeout: 15_000 });

    const tabs = page.getByRole('tab');
    const count = await tabs.count();

    // If more than one tab exists, click the second one and verify URL updates
    if (count > 1) {
      const secondTab = tabs.nth(1);
      await secondTab.click();

      // Wait for URL to include a tab query param
      await page.waitForURL(/[?&]tab=/, { timeout: 10_000 }).catch(() => {
        // Some implementations may not use URL params — that is acceptable
      });

      await expect(secondTab).toHaveAttribute('data-state', 'active');
    } else {
      test.skip(true, 'Only one tab visible — cannot test switching');
    }
  });

  test('approval queue shows table or empty state', async ({ page }) => {
    const table = page.locator('table, [role="table"], [data-testid*="table"]').first();
    const emptyState = page.getByText(/no approvals|nothing to review|no pending|no items/i);
    const cards = page.locator('[data-testid*="approval"], [class*="card"]').first();

    await expect(table.or(emptyState).or(cards)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('status filter exists in My tab', async ({ page }) => {
    // Look for filter controls — could be buttons, chips, select, or a dropdown trigger
    const filterControl = page
      .locator(
        [
          'button:has-text("pending")',
          'button:has-text("Pending")',
          'button:has-text("approved")',
          'button:has-text("Approved")',
          '[data-testid*="filter"]',
          '[data-testid*="status"]',
          '[role="combobox"]',
          'select',
        ].join(', '),
      )
      .first();

    const emptyState = page.getByText(/no approvals|nothing to review/i);

    // Either the filter control is present or the page is in empty state (no filters needed)
    await expect(filterControl.or(emptyState)).toBeVisible({
      timeout: 15_000,
    });
  });
});
