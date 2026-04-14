import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * Skip the current test if the page was redirected to login
 * (i.e. no valid session cookies were loaded from global-setup).
 */
export function skipIfUnauthenticated(page: Page) {
  test.skip(
    page.url().includes('/login'),
    'Set E2E_EMAIL and E2E_PASSWORD so global setup can log in.',
  );
}

/**
 * Navigate to a dashboard path and wait for the shell to render.
 * Returns immediately if redirected to login (caller should use skipIfUnauthenticated).
 */
export async function navigateToDashboard(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) return;
  await page.locator('#main-content').waitFor({ state: 'visible', timeout: 30_000 });
}

/**
 * Wait for the sidebar to be visible (dashboard shell fully rendered).
 */
export async function waitForSidebar(page: Page) {
  await page
    .locator("[data-sidebar='sidebar']")
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
}

/**
 * Open the user menu dropdown in the sidebar.
 */
export async function openUserMenu(page: Page) {
  const trigger = page.locator("[data-sidebar='menu-button']").last();
  await trigger.click();
  await page.locator('[role="menu"]').waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Assert that a page heading is visible with the expected text.
 */
export async function expectPageHeading(page: Page, text: string | RegExp) {
  await expect(page.locator('h1, h2').first()).toContainText(text, { timeout: 15_000 });
}
