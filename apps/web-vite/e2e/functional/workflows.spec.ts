import { expect, test } from '@playwright/test';

import {
  expectPageHeading,
  localePath,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Workflows list smoke — port from apps/web/e2e/functional/workflows.spec.ts
 * Routes: /:locale/workflows (Vite SPA, default locale pl).
 */
test.describe('Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, localePath('/workflows'));
    skipIfUnauthenticated(page);
  });

  test('workflows page renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('page shows heading', async ({ page }) => {
    await expectPageHeading(page, /workflow|przepływ|przeplyw/i);
  });

  test('table or empty state visible', async ({ page }) => {
    const table = page.locator('table, [role="table"], [data-testid*="table"]').first();
    const emptyState = page.getByText(
      /no workflows|create.*first|get started|no templates|brak|utwórz|rozpocznij/i,
    );
    const cards = page.locator('[data-testid*="workflow"], [class*="card"]').first();

    await expect(table.or(emptyState).or(cards)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('create template button exists', async ({ page }) => {
    const createButton = page
      .getByRole('button', { name: /create|new|add|utwórz|dodaj|start|rozpocznij/i })
      .first()
      .or(page.getByRole('link', { name: /create|new|add|utwórz|dodaj/i }).first());

    await createButton.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(createButton).toBeEnabled();
  });

  test('table rows or cards load', async ({ page }) => {
    const skeleton = page.locator('[data-testid*="skeleton"], [class*="skeleton"]').first();
    await skeleton.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {
      // Skeletons may not be present if content loaded fast or page is empty
    });

    const tableRows = page.locator('table tbody tr, [role="row"]').first();
    const cards = page.locator('[data-testid*="workflow"], [class*="card"]').first();
    const emptyState = page.getByText(
      /no workflows|create.*first|get started|no templates|brak|utwórz/i,
    );

    await expect(tableRows.or(cards).or(emptyState)).toBeVisible({
      timeout: 20_000,
    });
  });
});
