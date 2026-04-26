import { expect, test } from '@playwright/test';
import { navigateToDashboard, skipIfUnauthenticated } from './helpers';

/**
 * Responsive layout tests.
 * Verifies sidebar, search, and grid behavior at different viewport sizes.
 */

test.describe('Responsive — Desktop (1280×720)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('sidebar is visible on desktop', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    await expect(sidebar).toBeVisible({ timeout: 20_000 });
  });

  test('dashboard uses multi-column layout', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    // The main content area should exist and be wide enough for a multi-column grid
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible({ timeout: 20_000 });

    const box = await mainContent.boundingBox();
    expect(box).toBeTruthy();
    // On desktop with sidebar (240px) the content area should still be wider than 600px
    expect(box?.width).toBeGreaterThan(600);
  });
});

test.describe('Responsive — Mobile (375×667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('sidebar is hidden by default on mobile', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    // Give shell time to render, then assert sidebar is not visible
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    await expect(sidebar).not.toBeVisible({ timeout: 5_000 });
  });

  test('hamburger trigger opens sidebar on mobile', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    // SidebarTrigger is the hamburger button — look for it by its data attribute or role
    const trigger = page
      .locator(
        'button[data-sidebar="trigger"], button[aria-label*="sidebar" i], button[aria-label*="menu" i], button[aria-label*="toggle" i]',
      )
      .first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    // After clicking, the sidebar (or its sheet/overlay wrapper) should appear
    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('search trigger is compact on mobile (no "Search..." text)', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    // On mobile the full "Search..." label should not be visible;
    // the search trigger may still exist as an icon-only button
    const fullSearchLabel = page.locator('button:has-text("Search...")');
    await expect(fullSearchLabel).not.toBeVisible({ timeout: 5_000 });
  });

  test('main content stacks vertically on mobile', async ({ page }) => {
    await navigateToDashboard(page, '/en/');
    skipIfUnauthenticated(page);

    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible({ timeout: 20_000 });

    const box = await mainContent.boundingBox();
    expect(box).toBeTruthy();

    // On a 375px viewport the main content area should span close to full width
    // (no sidebar eating horizontal space)
    expect(box?.width).toBeGreaterThanOrEqual(350);
  });
});
