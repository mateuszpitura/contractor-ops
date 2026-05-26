import { expect, test } from '@playwright/test';

import {
  expectPageHeading,
  localePath,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Equipment list smoke — Step 13 batch 4 port from apps/web/e2e/functional/equipment.spec.ts
 * Routes: /:locale/equipment (Vite SPA, default locale pl).
 */
test.describe('Equipment', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, localePath('/equipment'));
    skipIfUnauthenticated(page);
  });

  test('equipment page renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /sprz[eę]t|equipment/i);
  });

  test('table or empty state visible', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyStateCta = page
      .getByRole('button', { name: /add equipment|new equipment|add item|dodaj sprz/i })
      .first();

    await expect(table.or(emptyStateCta)).toBeVisible({ timeout: 20_000 });
  });

  test('add equipment button exists', async ({ page }) => {
    const addButton = page
      .getByRole('button', { name: /add equipment|new equipment|add item|dodaj sprz/i })
      .first();

    await expect(addButton).toBeVisible({ timeout: 15_000 });
  });

  test('table has expected columns when data exists', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasTable, 'No table rendered — skipping column header test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'Table has no rows — skipping column header test');

    const headerCells = table.locator('thead th, thead [role="columnheader"]');
    const headerCount = await headerCells.count();
    expect(headerCount).toBeGreaterThanOrEqual(2);
  });
});
