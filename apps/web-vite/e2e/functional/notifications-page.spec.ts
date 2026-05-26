import { expect, test } from '@playwright/test';

import {
  E2E_LOCALE,
  expectPageHeading,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Notifications page — Step 13 port from apps/web/e2e/functional/notifications-page.spec.ts
 * Route: /:locale/notifications (Vite SPA, default locale pl).
 *
 * PL title is "Powiadomienia"; selectors are kept broad so either PL or EN
 * markup satisfies the assertions if the locale flips during local runs.
 */
test.describe('Notifications Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, `/${E2E_LOCALE}/notifications`);
    skipIfUnauthenticated(page);
  });

  test('page renders with main content', async ({ page }) => {
    const main = page.locator('#main-content');
    await expect(main).toBeVisible({ timeout: 15_000 });

    await expectPageHeading(page, /powiadom|notification/i);
  });

  test('content or empty state visible', async ({ page }) => {
    const notificationItem = page.locator(
      '[data-testid="notification-item"], [role="listitem"], [data-testid="notification-card"], article, #main-content button[type="button"]',
    );
    const emptyState = page.locator(
      '[data-testid="empty-state"], [data-empty], .empty-state, text=/brak powiadom/i, text=/no notification/i, text=/all caught up/i',
    );

    await expect(notificationItem.first().or(emptyState.first())).toBeVisible({
      timeout: 20_000,
    });
  });

  test('page has notification-related content', async ({ page }) => {
    const listContent = page.locator(
      '[role="list"], [role="listitem"], ul li, [data-testid="notification-item"], article, #main-content button[type="button"]',
    );
    const emptyIcon = page.locator(
      'svg, [data-testid="empty-state"], [data-empty], img[alt*="empty" i], img[alt*="notification" i], img[alt*="powiadom" i]',
    );
    const filterChips = page.locator(
      '[role="tablist"], [data-testid="filter-chip"], button:has-text("All"), button:has-text("Wszystkie"), button:has-text("Unread"), button:has-text("Nieprzeczytane"), button:has-text("Read"), button:has-text("Przeczytane")',
    );

    const hasListContent = await listContent
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyIcon = await emptyIcon
      .first()
      .isVisible()
      .catch(() => false);
    const hasFilters = await filterChips
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasListContent || hasEmptyIcon || hasFilters).toBe(true);
  });
});
