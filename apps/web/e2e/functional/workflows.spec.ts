import { expect, test } from '@playwright/test';
import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/workflows');
    skipIfUnauthenticated(page);
  });

  test('workflows page renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /workflows/i);
  });

  test('table or empty state visible', async ({ page }) => {
    const table = page.locator('table, [role="table"], [data-testid*="table"]').first();
    const emptyState = page.getByText(/no workflows|create.*first|get started|no templates/i);
    const cards = page.locator('[data-testid*="workflow"], [class*="card"]').first();

    await expect(table.or(emptyState).or(cards)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('create template button exists', async ({ page }) => {
    const createButton = page
      .getByRole('button', { name: /create|new|add/i })
      .first()
      .or(page.getByRole('link', { name: /create|new|add/i }).first());

    await createButton.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(createButton).toBeEnabled();
  });

  test('table rows or cards load', async ({ page }) => {
    // Wait for loading skeletons to disappear (if any)
    const skeleton = page.locator('[data-testid*="skeleton"], [class*="skeleton"]').first();
    await skeleton.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {
      // Skeletons may not be present if content loaded fast or page is empty
    });

    // Verify either table rows, cards, or an empty state is rendered
    const tableRows = page.locator('table tbody tr, [role="row"]').first();
    const cards = page.locator('[data-testid*="workflow"], [class*="card"]').first();
    const emptyState = page.getByText(/no workflows|create.*first|get started|no templates/i);

    await expect(tableRows.or(cards).or(emptyState)).toBeVisible({
      timeout: 20_000,
    });
  });
});
