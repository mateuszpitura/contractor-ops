import { expect, test } from '@playwright/test';

import {
  expectPageHeading,
  localePath,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Payments list smoke — port from apps/web/e2e/functional/payments.spec.ts
 * Routes: /:locale/payments (Vite SPA, default locale pl).
 */
test.describe('Payments', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, localePath('/payments'));
    skipIfUnauthenticated(page);
  });

  test('payments page renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /payment|płatno|platn/i);
  });

  test('table or empty state visible', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyState = page
      .getByRole('button', { name: /add|create|new|start|dodaj|utwórz|nowa/i })
      .first();

    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('add/create payment run button exists', async ({ page }) => {
    const addButton = page
      .getByRole('button', {
        name: /add payment|new payment|create payment|nowa płatno|nowy przelew|payment run/i,
      })
      .first();

    await expect(addButton).toBeVisible({ timeout: 15_000 });
  });

  test('table rows clickable opens side panel', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasTable, 'No table rendered — skipping side panel test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'Table has no rows — skipping side panel test');

    await rows.first().click();

    const sidePanel = page
      .locator(
        '[data-state="open"][role="dialog"], [data-state="open"][data-radix-dialog-content], [role="dialog"], [data-side-panel], aside',
      )
      .first();

    await expect(sidePanel).toBeVisible({ timeout: 10_000 });
  });
});
