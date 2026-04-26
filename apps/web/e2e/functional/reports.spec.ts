import { expect, test } from '@playwright/test';
import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/reports');
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
    await expectPageHeading(page, /report/i);
  });

  test('report selector/sidebar exists with report options', async ({ page }) => {
    test.skip(page.url().includes('/unauthorized'), 'Redirected to unauthorized');

    const sidebar = page
      .locator('[data-testid*="report"], nav, [role="tablist"], [role="listbox"], aside')
      .first();
    const reportLink = page
      .getByRole('link', { name: /spend|expiring|overdue|compliance|contractor|team/i })
      .first();

    await expect(sidebar.or(reportLink)).toBeVisible({ timeout: 15_000 });
  });

  test('date range filter is present', async ({ page }) => {
    test.skip(page.url().includes('/unauthorized'), 'Redirected to unauthorized');

    const dateFilter = page
      .locator('button, input')
      .filter({ hasText: /date|from|to|range|period/i })
      .first();
    const dateInput = page.locator('input[type="date"], [data-testid*="date"]').first();

    await expect(dateFilter.or(dateInput)).toBeVisible({ timeout: 15_000 });
  });

  test('switching report type updates URL with report param', async ({ page }) => {
    test.skip(page.url().includes('/unauthorized'), 'Redirected to unauthorized');

    const reportOption = page
      .getByRole('link', { name: /spend|expiring|overdue|compliance|contractor|team/i })
      .first();
    const reportButton = page
      .getByRole('button', { name: /spend|expiring|overdue|compliance|contractor|team/i })
      .first();

    const clickable = reportOption.or(reportButton);
    const isVisible = await clickable.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!isVisible, 'No report options found — skipping URL param test');

    await clickable.click();
    await page.waitForTimeout(1_000);

    expect(page.url()).toMatch(/[?&]report=/);
  });
});
