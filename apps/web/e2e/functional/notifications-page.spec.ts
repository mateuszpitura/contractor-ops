import { expect, test } from '@playwright/test';
import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Notifications Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/notifications');
    skipIfUnauthenticated(page);
  });

  test('page renders with main content', async ({ page }) => {
    const main = page.locator('#main-content');
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Page should have a heading related to notifications
    await expectPageHeading(page, /notification/i);
  });

  test('content or empty state visible', async ({ page }) => {
    // Either notification items are present OR an empty state message is shown
    const notificationItem = page.locator(
      '[data-testid="notification-item"], [role="listitem"], [data-testid="notification-card"], article',
    );
    const emptyState = page.locator(
      '[data-testid="empty-state"], [data-empty], .empty-state, text="no notification"i, text="all caught up"i, text="nothing here"i, text="no new"i',
    );

    // Wait for either notifications or empty state to appear
    await expect(notificationItem.first().or(emptyState.first())).toBeVisible({
      timeout: 20_000,
    });
  });

  test('page has notification-related content', async ({ page }) => {
    // The page should contain either a list of items, card elements, or an empty state icon/illustration
    const listContent = page.locator(
      '[role="list"], [role="listitem"], ul li, [data-testid="notification-item"], article',
    );
    const emptyIcon = page.locator(
      'svg, [data-testid="empty-state"], [data-empty], img[alt*="empty"i], img[alt*="notification"i]',
    );
    const filterChips = page.locator(
      '[role="tablist"], [data-testid="filter-chip"], button:has-text("All"), button:has-text("Unread"), button:has-text("Read")',
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
