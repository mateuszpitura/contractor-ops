import { expect, test } from '@playwright/test';

import { E2E_LOCALE, navigateToDashboard, skipIfUnauthenticated } from './helpers';

/**
 * Responsive layout tests — Step 13 port from apps/web/e2e/functional/responsive.spec.ts.
 *
 * Verifies sidebar + main content behavior at desktop and mobile viewports
 * against the Vite SPA dashboard shell (`/${E2E_LOCALE}` index, no `/v2`).
 *
 * Shell selectors (see apps/web-vite/src/components/layout/dashboard-shell.tsx
 * and top-bar.tsx):
 *   - `#main-content`           — main content area (id on the inner wrapper)
 *   - `[data-sidebar='sidebar']` — shadcn SidebarProvider sidebar element
 *   - `[data-sidebar='trigger']` — shadcn SidebarTrigger hamburger (in TopBar)
 *
 * The legacy spec's "Search..." compact-trigger assertion is dropped:
 * the Vite shell's TopBar exposes no global search button, so the check would
 * pass trivially and provide no signal.
 */

const DASHBOARD_PATH = `/${E2E_LOCALE}`;

test.describe('Responsive — Desktop (1280×720)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('sidebar is visible on desktop', async ({ page }) => {
    await navigateToDashboard(page, DASHBOARD_PATH);
    skipIfUnauthenticated(page);

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    await expect(sidebar).toBeVisible({ timeout: 20_000 });
  });

  test('dashboard uses multi-column layout', async ({ page }) => {
    await navigateToDashboard(page, DASHBOARD_PATH);
    skipIfUnauthenticated(page);

    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible({ timeout: 20_000 });

    const box = await mainContent.boundingBox();
    expect(box).toBeTruthy();
    // With sidebar (~240px) on a 1280px viewport the content area should still
    // be wider than 600px — proves we have a real side-by-side layout.
    expect(box?.width).toBeGreaterThan(600);
  });
});

test.describe('Responsive — Mobile (375×667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('sidebar is hidden by default on mobile', async ({ page }) => {
    await navigateToDashboard(page, DASHBOARD_PATH);
    skipIfUnauthenticated(page);

    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    await expect(sidebar).not.toBeVisible({ timeout: 5_000 });
  });

  test('hamburger trigger opens sidebar on mobile', async ({ page }) => {
    await navigateToDashboard(page, DASHBOARD_PATH);
    skipIfUnauthenticated(page);

    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    // shadcn SidebarTrigger renders `button[data-sidebar="trigger"]`.
    // Keep ARIA-label fallbacks for resilience if the shell is restyled.
    const trigger = page
      .locator(
        'button[data-sidebar="trigger"], button[aria-label*="sidebar" i], button[aria-label*="menu" i], button[aria-label*="toggle" i]',
      )
      .first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.click();

    const sidebar = page.locator("[data-sidebar='sidebar']").first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('main content stacks vertically on mobile', async ({ page }) => {
    await navigateToDashboard(page, DASHBOARD_PATH);
    skipIfUnauthenticated(page);

    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible({ timeout: 20_000 });

    const box = await mainContent.boundingBox();
    expect(box).toBeTruthy();
    // On a 375px viewport the main content area should span close to full width
    // (sidebar collapsed into a sheet, not eating horizontal space).
    expect(box?.width).toBeGreaterThanOrEqual(350);
  });
});
