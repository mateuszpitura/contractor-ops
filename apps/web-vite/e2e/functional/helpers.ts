import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** Default locale for Vite SPA routes (matches `DEFAULT_LOCALE` in i18n). */
export const E2E_LOCALE = 'pl';

/** Locale-prefixed path helper — e.g. `localePath('/payments')` → `/pl/payments`. */
export function localePath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `/${E2E_LOCALE}${normalized}`;
}

/** Split-button import label (EN + PL). */
export const IMPORT_EINVOICE_PATTERN = /import e-invoice|importuj e-faktur/i;

/** Portal login URL pattern for the default E2E locale. */
export const PORTAL_LOGIN_PATTERN = new RegExp(`/${E2E_LOCALE}/portal/login`);

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
 * Skip when portal routes redirect to portal login — dashboard session does
 * not grant portal access (magic-link `portal_session` required).
 */
export function skipIfPortalUnauthenticated(page: Page) {
  test.skip(
    page.url().includes('/portal/login'),
    'Dashboard auth does not grant portal access — magic link required',
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

/**
 * Open the e-invoice intake upload dialog via the split-button dropdown.
 * Returns false when `einvoice.import-enabled` is off (plain "New invoice" only).
 */
export async function openIntakeUploadDialog(page: Page): Promise<boolean> {
  const importTrigger = page.getByRole('button', { name: IMPORT_EINVOICE_PATTERN });
  const importEnabled = await importTrigger.isVisible({ timeout: 10_000 }).catch(() => false);
  if (!importEnabled) return false;

  await importTrigger.click();
  const menuItem = page.getByRole('menuitem', { name: IMPORT_EINVOICE_PATTERN });
  if (await menuItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await menuItem.click();
  }

  await expect(page.locator('[data-slot="intake-upload-dropzone"]')).toBeVisible({
    timeout: 10_000,
  });
  return true;
}
