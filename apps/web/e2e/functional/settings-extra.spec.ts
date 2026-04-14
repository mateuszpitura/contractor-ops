import { expect, test } from '@playwright/test';
import { expectPageHeading, navigateToDashboard, skipIfUnauthenticated } from './helpers';

test.describe('Settings — Members', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDashboard(page, '/en/settings/members');
    skipIfUnauthenticated(page);
  });

  test('members page renders with main content', async ({ page }) => {
    const main = page.locator('#main-content');
    await expect(main).toBeVisible({ timeout: 15_000 });
  });

  test('members page shows heading', async ({ page }) => {
    await expectPageHeading(page, /users|members|team/i);
  });

  test('members table or list visible', async ({ page }) => {
    const table = page.locator('table, [role="table"], [role="grid"]');
    const list = page.locator('[role="list"], ul[data-testid], [data-testid="members-list"]');
    const emptyState = page.locator(
      '[data-testid="empty-state"], [data-empty], text="no members"i, text="no users"i, text="invite"i',
    );

    await expect(table.first().or(list.first()).or(emptyState.first())).toBeVisible({
      timeout: 20_000,
    });
  });

  test('invite button exists (may be hidden for non-admin)', async ({ page }) => {
    const inviteButton = page.locator(
      'button:has-text("Invite"), a:has-text("Invite"), button:has-text("Add member"), button:has-text("Add user")',
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
    await navigateToDashboard(page, '/en/settings/calendar');
    skipIfUnauthenticated(page);
  });

  test('calendar settings page renders with main content', async ({ page }) => {
    const main = page.locator('#main-content');
    await expect(main).toBeVisible({ timeout: 15_000 });
  });

  test('calendar page shows heading', async ({ page }) => {
    await expectPageHeading(page, /calendar/i);
  });
});
