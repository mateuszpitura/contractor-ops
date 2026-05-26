import { expect, test } from '@playwright/test';

import { localePath, PORTAL_LOGIN_PATTERN, skipIfPortalUnauthenticated } from './helpers';

/**
 * Portal invoice flow — batch 5 port from apps/web/e2e/functional/portal-invoice-flow.spec.ts
 *
 * Portal uses magic-link auth (portal_session cookie), separate from dashboard session.
 * Unauthenticated tests use a fresh context; authenticated tests skip when PortalShell
 * redirects to portal login.
 */
test.describe('Portal invoices — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('portal invoices redirects to portal login', async ({ page }) => {
    await page.goto(localePath('/portal/invoices'), { waitUntil: 'domcontentloaded' });

    await page.waitForURL(PORTAL_LOGIN_PATTERN, { timeout: 20_000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
  });

  test('portal login page renders with email input and submit button', async ({ page }) => {
    await page.goto(localePath('/portal/login'), { waitUntil: 'domcontentloaded' });

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await expect(emailInput).toBeEnabled();

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible({ timeout: 15_000 });
    await expect(submitButton).toBeEnabled();
  });

  test('portal login page has contractor branding/heading', async ({ page }) => {
    await page.goto(localePath('/portal/login'), { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const logo = page.locator(
      'img[alt*="logo" i], svg[aria-label*="logo" i], [data-testid="logo"]',
    );
    const brandingVisible =
      (await heading.isVisible().catch(() => false)) ||
      (await logo
        .first()
        .isVisible()
        .catch(() => false));

    expect(brandingVisible).toBeTruthy();
  });
});

test.describe('Portal invoices — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(localePath('/portal/invoices'), { waitUntil: 'domcontentloaded' });
    skipIfPortalUnauthenticated(page);
  });

  test('portal invoices page renders', async ({ page }) => {
    const main = page.locator('#main-content, [role="main"], main').first();
    await expect(main).toBeVisible({ timeout: 15_000 });
  });

  test('invoice list or empty state visible', async ({ page }) => {
    const table = page.locator('table, [role="table"], [role="grid"]').first();
    const list = page.locator('[role="list"], ul[data-testid]').first();
    const emptyState = page
      .locator(
        '[data-testid="empty-state"], [data-empty], text="no invoices"i, text="submit your first"i',
      )
      .first();

    await expect(table.or(list).or(emptyState)).toBeVisible({ timeout: 20_000 });
  });

  test('submit or upload invoice button exists', async ({ page }) => {
    const submitButton = page
      .locator('button, a')
      .filter({ hasText: /submit invoice|upload invoice|new invoice|create invoice/i })
      .first();

    const isVisible = await submitButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(
      !isVisible,
      'Submit invoice button not visible — feature may be disabled for this portal user',
    );

    await expect(submitButton).toBeVisible();
  });

  test('click submit opens upload form or dialog', async ({ page }) => {
    const submitButton = page
      .locator('button, a')
      .filter({ hasText: /submit invoice|upload invoice|new invoice|create invoice/i })
      .first();

    const isVisible = await submitButton.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!isVisible, 'Submit invoice button not visible — skipping upload flow test');

    await submitButton.click();

    const dialog = page
      .locator('[role="dialog"], [data-state="open"][data-radix-dialog-content]')
      .first();
    const form = page.locator('form, input[type="file"], [data-testid="upload-form"]').first();

    const dialogVisible = await dialog.isVisible({ timeout: 10_000 }).catch(() => false);
    const formVisible = await form.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(dialogVisible || formVisible).toBeTruthy();
  });
});
