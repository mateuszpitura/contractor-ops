import { expect, test } from '@playwright/test';
import { navigateToDashboard, skipIfUnauthenticated, waitForSidebar } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);
  });

  test('dashboard shell renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
    await waitForSidebar(page);
  });

  test('dashboard shows content or empty state', async ({ page }) => {
    const kpiCards = page.locator('[data-testid="kpi-card"], [class*="card"]').first();
    const emptyState = page.getByRole('heading', { name: /get started/i });

    // Either KPI cards are visible OR the empty-state heading is shown
    await expect(kpiCards.or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('KPI cards render when org has data', async ({ page }) => {
    const emptyState = page.getByRole('heading', { name: /get started/i });
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    test.skip(!!hasEmptyState, 'Org is in empty state — KPI cards not expected');

    const cards = page.locator('[data-testid="kpi-card"], [class*="card"]');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });

    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('dashboard widgets load without errors', async ({ page }) => {
    // Wait for main content to settle
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
      // networkidle may not fire in all environments; continue regardless
    });

    // Verify no uncaught error dialogs are visible
    const errorDialog = page.locator('[role="alertdialog"], [role="alert"][data-error]');
    await expect(errorDialog).toHaveCount(0);
  });

  test('dashboard page has no console errors', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', error => jsErrors.push(error));

    // Re-navigate to capture errors from a fresh load
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
      // networkidle may not fire; continue
    });

    expect(jsErrors).toHaveLength(0);
  });
});
