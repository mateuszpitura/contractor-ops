import { expect, test } from '@playwright/test';

import { localePath, navigateToDashboard, skipIfUnauthenticated, waitForSidebar } from './helpers';

/**
 * Dashboard home smoke — port from apps/web/e2e/functional/dashboard.spec.ts
 * Routes: /:locale/ (Vite SPA, default locale pl).
 */
test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, localePath('/'));
    skipIfUnauthenticated(page);
  });

  test('dashboard shell renders', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
    await waitForSidebar(page);
  });

  test('dashboard shows content or greeting', async ({ page }) => {
    const kpiCards = page.locator('[data-testid="kpi-card"], [class*="card"]').first();
    const greeting = page.locator('h1').first();

    await expect(kpiCards.or(greeting)).toBeVisible({ timeout: 20_000 });
  });

  test('KPI cards render when org has data', async ({ page }) => {
    const cards = page.locator('[data-testid="kpi-card"], main [class*="card"]');
    const hasCards = await cards
      .first()
      .isVisible({ timeout: 20_000 })
      .catch(() => false);

    test.skip(!hasCards, 'No KPI cards in this env — org may have no dashboard metrics yet');

    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('dashboard widgets load without errors', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
      // networkidle may not fire in all environments; continue regardless
    });

    const errorDialog = page.locator('[role="alertdialog"], [role="alert"][data-error]');
    await expect(errorDialog).toHaveCount(0);
  });

  test('dashboard page has no console errors', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', error => jsErrors.push(error));

    await navigateToDashboard(page, localePath('/'));
    skipIfUnauthenticated(page);

    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
      // networkidle may not fire; continue
    });

    expect(jsErrors).toHaveLength(0);
  });
});
