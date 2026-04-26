import { expect, test } from '@playwright/test';

/**
 * Contractor portal login page tests.
 *
 * Portal uses magic-link auth (portal_session cookie), which is separate from
 * the main dashboard session. Tests run with a fresh browser context so no
 * stored dashboard auth leaks in.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Portal login', () => {
  test('login page renders with heading', async ({ page }) => {
    await page.goto('/en/portal/login', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 15_000 });
    await expect(heading).toHaveCSS('font-size', '28px');
  });

  test('email input is present', async ({ page }) => {
    await page.goto('/en/portal/login', { waitUntil: 'domcontentloaded' });

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await expect(emailInput).toBeEnabled();
  });

  test('send magic link button exists', async ({ page }) => {
    await page.goto('/en/portal/login', { waitUntil: 'domcontentloaded' });

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible({ timeout: 15_000 });
    await expect(submitButton).toBeEnabled();
  });

  test('empty email submission shows validation error', async ({ page }) => {
    await page.goto('/en/portal/login', { waitUntil: 'domcontentloaded' });
    await page.locator('button[type="submit"]').waitFor({ state: 'visible', timeout: 15_000 });

    // Submit without filling in the email
    await page.locator('button[type="submit"]').click();

    // Expect inline validation error
    const errorText = page.locator('.text-destructive').first();
    await expect(errorText).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated portal access redirects to login', async ({ page }) => {
    await page.goto('/en/portal/contracts', { waitUntil: 'domcontentloaded' });

    // Should redirect to the portal login page
    await page.waitForURL(/\/en\/portal\/login/, { timeout: 20_000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
  });
});
