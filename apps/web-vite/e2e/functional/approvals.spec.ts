import { expect, test } from '@playwright/test';

import {
  E2E_LOCALE,
  expectPageHeading,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Approvals queue smoke — batch 2 port from apps/web/e2e/functional/approvals.spec.ts
 * Routes: /:locale/approvals (Vite SPA, default locale pl).
 */
test.describe('Approvals', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, `/${E2E_LOCALE}/approvals`);
    skipIfUnauthenticated(page);
  });

  test('approvals page renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /akceptacj|approvals/i);
  });

  test('default "My" tab is active', async ({ page }) => {
    const myTab = page.getByRole('tab', { name: /moje akceptacje|my/i }).first();
    await myTab.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(myTab).toHaveAttribute('data-state', 'active');
  });

  test('tab triggers are visible', async ({ page }) => {
    const tabList = page.getByRole('tablist').first();
    await tabList.waitFor({ state: 'visible', timeout: 15_000 });

    const myTab = page.getByRole('tab', { name: /moje akceptacje|my/i }).first();
    await expect(myTab).toBeVisible();

    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('tab switching works', async ({ page }) => {
    const tabList = page.getByRole('tablist').first();
    await tabList.waitFor({ state: 'visible', timeout: 15_000 });

    const tabs = page.getByRole('tab');
    const count = await tabs.count();

    if (count > 1) {
      const secondTab = tabs.nth(1);
      await secondTab.click();

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
    const emptyState = page.getByText(
      /brak oczekujących akceptacji|no approvals|nothing to review|no pending|no items/i,
    );
    const cards = page.locator('[data-testid*="approval"], [class*="card"]').first();

    await expect(table.or(emptyState).or(cards)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('status filter exists in My tab', async ({ page }) => {
    const filterControl = page
      .locator(
        [
          'button:has-text("oczekujące")',
          'button:has-text("Oczekujące")',
          'button:has-text("pending")',
          'button:has-text("Pending")',
          'button:has-text("zaakceptowane")',
          'button:has-text("Zaakceptowane")',
          'button:has-text("approved")',
          'button:has-text("Approved")',
          '[data-testid*="filter"]',
          '[data-testid*="status"]',
          '[role="combobox"]',
          'select',
        ].join(', '),
      )
      .first();

    const emptyState = page.getByText(
      /brak oczekujących akceptacji|no approvals|nothing to review/i,
    );

    await expect(filterControl.or(emptyState)).toBeVisible({
      timeout: 15_000,
    });
  });
});
