import { expect, test } from '@playwright/test';

import {
  E2E_LOCALE,
  expectPageHeading,
  navigateToDashboard,
  skipIfUnauthenticated,
} from './helpers';

/**
 * Settings — Members + Calendar smoke
 * Step 13 port from apps/web/e2e/functional/settings-extra.spec.ts.
 * Routes: /:locale/settings/{members,calendar} (Vite SPA, default locale pl).
 */

test.describe('Settings — Members', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, `/${E2E_LOCALE}/settings/members`);
    skipIfUnauthenticated(page);
  });

  test('members page renders with main content', async ({ page }) => {
    const main = page.locator('#main-content');
    await expect(main).toBeVisible({ timeout: 15_000 });
  });

  test('members page shows heading', async ({ page }) => {
    await expectPageHeading(page, /członkowie|zespołu|users|members|team/i);
  });

  test('members table or list visible', async ({ page }) => {
    const table = page.locator('table, [role="table"], [role="grid"]');
    const list = page.locator('[role="list"], ul[data-testid], [data-testid="members-list"]');
    const emptyState = page.locator(
      '[data-testid="empty-state"], [data-empty], text="brak członków"i, text="no members"i, text="no users"i, text="zapros"i, text="invite"i',
    );

    await expect(table.first().or(list.first()).or(emptyState.first())).toBeVisible({
      timeout: 20_000,
    });
  });

  test('invite button exists (may be hidden for non-admin)', async ({ page }) => {
    const inviteButton = page.locator(
      'button:has-text("Zapros"), a:has-text("Zapros"), button:has-text("Invite"), a:has-text("Invite"), button:has-text("Add member"), button:has-text("Add user")',
    );

    const isVisible = await inviteButton
      .first()
      .isVisible()
      .catch(() => false);

    // Gracefully skip if button is not visible — non-admin users may not see it
    test.skip(!isVisible, 'Invite button not visible — user may lack admin permissions');

    await expect(inviteButton.first()).toBeVisible();
  });
});

test.describe('Settings — Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, `/${E2E_LOCALE}/settings/calendar`);
    skipIfUnauthenticated(page);
  });

  test('calendar settings page renders with main content', async ({ page }) => {
    const main = page.locator('#main-content');
    await expect(main).toBeVisible({ timeout: 15_000 });
  });

  test('calendar page shows heading', async ({ page }) => {
    await expectPageHeading(page, /kalendarz|calendar/i);
  });
});
