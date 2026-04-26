import { expect, test } from '@playwright/test';
import {
  navigateToDashboard,
  openUserMenu,
  skipIfUnauthenticated,
  waitForSidebar,
} from './helpers';

/**
 * Sidebar navigation and global navigation element tests.
 * These use the default stored auth from global-setup.
 */
test.describe('Navigation', () => {
  test('sidebar renders with key nav items', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);
    await waitForSidebar(page);

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    const navLinks = sidebar.locator('a');

    for (const label of ['Contractors', 'Invoices', 'Contracts', 'Approvals', 'Settings']) {
      await expect(navLinks.filter({ hasText: label }).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('sidebar nav links navigate correctly', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);
    await waitForSidebar(page);

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    const contractorsLink = sidebar.locator('a').filter({ hasText: 'Contractors' }).first();
    await contractorsLink.click();

    await page.waitForURL(/\/contractors/, { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('active nav item has aria-current', async ({ page }) => {
    await navigateToDashboard(page, '/en/contractors');
    skipIfUnauthenticated(page);
    await waitForSidebar(page);

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    const contractorsLink = sidebar.locator('a').filter({ hasText: 'Contractors' }).first();
    await expect(contractorsLink).toHaveAttribute('aria-current', 'page', { timeout: 10_000 });
  });

  test('breadcrumb shows current page', async ({ page }) => {
    await navigateToDashboard(page, '/en/contractors');
    skipIfUnauthenticated(page);

    const breadcrumb = page.locator('nav').locator('text=Contractors');
    await expect(breadcrumb.first()).toBeVisible({ timeout: 15_000 });
  });

  test('search bar opens command palette', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    // Click the search trigger
    const searchTrigger = page.locator('.search-trigger, button:has-text("Search...")').first();
    await searchTrigger.waitFor({ state: 'visible', timeout: 15_000 });
    await searchTrigger.click();

    // Expect a command palette dialog to appear with a search input
    const dialog = page.locator('[role="dialog"], [cmdk-dialog], [data-cmdk-root]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.locator('input[type="text"], input[type="search"], [cmdk-input]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test('user menu opens with options', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);
    await waitForSidebar(page);

    await openUserMenu(page);

    const menu = page.locator('[role="menu"]');
    await expect(
      menu
        .locator('[role="menuitem"]')
        .filter({ hasText: /settings/i })
        .first(),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      menu
        .locator('[role="menuitem"]')
        .filter({ hasText: /sign\s*out|log\s*out/i })
        .first(),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test('notifications popover opens', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    // Click the bell/notification icon button
    const bellButton = page
      .locator('button')
      .filter({ has: page.locator('svg') })
      .filter({ hasText: /^$/ })
      .locator('visible=true')
      .or(page.locator('button[aria-label*="notification" i], button[aria-label*="bell" i]'))
      .first();
    await bellButton.waitFor({ state: 'visible', timeout: 15_000 });
    await bellButton.click();

    // Expect a popover or dropdown with notification content
    const popover = page
      .locator('[role="dialog"], [data-radix-popper-content-wrapper], [data-state="open"]')
      .first();
    await expect(popover).toBeVisible({ timeout: 10_000 });
  });
});
