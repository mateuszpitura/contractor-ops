import { expect, test } from '@playwright/test';

import {
  localePath,
  navigateToDashboard,
  openUserMenu,
  skipIfUnauthenticated,
  waitForSidebar,
} from './helpers';

/**
 * Sidebar navigation smoke — Step 13 batch 4 port from apps/web/e2e/functional/navigation.spec.ts
 * Routes: /:locale/* (Vite SPA, default locale pl).
 */
test.describe('Navigation', () => {
  test('sidebar renders with key nav items', async ({ page }) => {
    await navigateToDashboard(page, localePath('/'));
    skipIfUnauthenticated(page);
    await waitForSidebar(page);

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    const navLinks = sidebar.locator('a');

    for (const label of [
      /kontrahent|contractor/i,
      /faktur|invoice/i,
      /umow|contract/i,
      /zatwierdzen|approval/i,
      /ustawien|setting/i,
    ]) {
      await expect(navLinks.filter({ hasText: label }).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('sidebar nav links navigate correctly', async ({ page }) => {
    await navigateToDashboard(page, localePath('/'));
    skipIfUnauthenticated(page);
    await waitForSidebar(page);

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    const contractorsLink = sidebar
      .locator('a')
      .filter({ hasText: /kontrahent|contractor/i })
      .first();
    await contractorsLink.click();

    await page.waitForURL(/\/contractors/, { timeout: 15_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('active nav item has aria-current', async ({ page }) => {
    await navigateToDashboard(page, localePath('/contractors'));
    skipIfUnauthenticated(page);
    await waitForSidebar(page);

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    const contractorsLink = sidebar
      .locator('a')
      .filter({ hasText: /kontrahent|contractor/i })
      .first();
    await expect(contractorsLink).toHaveAttribute('aria-current', 'page', { timeout: 10_000 });
  });

  test('breadcrumb shows current page', async ({ page }) => {
    await navigateToDashboard(page, localePath('/contractors'));
    skipIfUnauthenticated(page);

    const breadcrumb = page
      .locator('nav[aria-label="breadcrumb"], [data-slot="breadcrumb"]')
      .getByText(/kontrahent|contractor/i);
    await expect(breadcrumb.first()).toBeVisible({ timeout: 15_000 });
  });

  test('search bar opens command palette', async ({ page }) => {
    await navigateToDashboard(page, localePath('/'));
    skipIfUnauthenticated(page);

    const searchTrigger = page
      .locator('.search-trigger, button:has-text("Search"), button:has-text("Szukaj")')
      .first();
    const searchVisible = await searchTrigger.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!searchVisible, 'Command palette search not mounted in web-vite dashboard shell yet');

    await searchTrigger.click();

    const dialog = page.locator('[role="dialog"], [cmdk-dialog], [data-cmdk-root]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.locator('input[type="text"], input[type="search"], [cmdk-input]').first(),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test('user menu opens with options', async ({ page }) => {
    await navigateToDashboard(page, localePath('/'));
    skipIfUnauthenticated(page);
    await waitForSidebar(page);

    await openUserMenu(page);

    const menu = page.locator('[role="menu"]');
    await expect(
      menu
        .locator('[role="menuitem"]')
        .filter({ hasText: /ustawien|setting/i })
        .first(),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      menu
        .locator('[role="menuitem"]')
        .filter({ hasText: /sign\s*out|log\s*out|wyloguj/i })
        .first(),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test('notifications popover opens', async ({ page }) => {
    await navigateToDashboard(page, localePath('/'));
    skipIfUnauthenticated(page);

    const bellButton = page
      .locator('button[aria-label*="notification" i], button[aria-label*="powiadomien" i]')
      .first();
    const bellVisible = await bellButton.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!bellVisible, 'Notification popover not mounted in web-vite dashboard shell yet');

    await bellButton.click();

    const popover = page
      .locator('[role="dialog"], [data-radix-popper-content-wrapper], [data-state="open"]')
      .first();
    await expect(popover).toBeVisible({ timeout: 10_000 });
  });
});
