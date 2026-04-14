import { expect, test } from '@playwright/test';
import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Contracts', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/contracts');
    skipIfUnauthenticated(page);
  });

  test('contracts page renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /contracts/i);
  });

  test('table or empty state visible', async ({ page }) => {
    const table = page.locator('table').first();
    const emptyStateCta = page
      .getByRole('button', { name: /create contract|add contractors first/i })
      .first();

    await expect(table.or(emptyStateCta)).toBeVisible({ timeout: 20_000 });
  });

  test('search input present', async ({ page }) => {
    // Wait for content to settle before checking for search
    const table = page.locator('table').first();
    const emptyState = page
      .getByRole('button', { name: /create contract|add contractors first/i })
      .first();
    await expect(table.or(emptyState)).toBeVisible({ timeout: 20_000 });

    // Search input should be in the toolbar when table is rendered
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No table rendered — search toolbar not expected in empty state');

    const searchInput = page
      .getByRole('textbox', { name: /search/i })
      .or(page.locator('input[placeholder*="earch"]'))
      .first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
  });

  test('create contract button exists', async ({ page }) => {
    const createButton = page
      .getByRole('button', { name: /create contract|new contract/i })
      .first();

    await expect(createButton).toBeVisible({ timeout: 15_000 });
  });

  test('table rows are clickable when data exists', async ({ page }) => {
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasTable, 'No table rendered — skipping row interaction test');

    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    test.skip(rowCount === 0, 'Table has no rows — skipping row interaction test');

    // Click the first data row
    await rows.first().click();

    // Verify a side panel or sheet opens
    const sidePanel = page
      .locator('[role="dialog"], [data-state="open"], [class*="sheet"], [class*="panel"]')
      .first();
    await expect(sidePanel).toBeVisible({ timeout: 10_000 });
  });

  test('URL action=new opens wizard', async ({ page }) => {
    await navigateToDashboard(page, '/en/contracts?action=new');
    skipIfUnauthenticated(page);

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
  });
});
