import { expect, test } from '@playwright/test';

/**
 * Authentication flow tests.
 * These run with a fresh browser context (no stored session).
 */
test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('Authentication', () => {
  test('login page renders with form inputs', async ({ page }) => {
    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('#email').fill('invalid-user@example.com');
    await page.locator('#password').fill('wrong-password-123');
    await page.locator('button[type="submit"]').click();

    // Expect an error indicator — either a toast, inline form error, or alert
    const errorLocator = page
      .locator(
        '[role="alert"], [data-sonner-toast], [aria-live="polite"], .text-destructive, form .text-red-500, form .text-destructive',
      )
      .first();
    await expect(errorLocator).toBeVisible({ timeout: 15_000 });
  });

  test('login redirects to dashboard on valid credentials', async ({ page }) => {
    test.skip(!(EMAIL && PASSWORD), 'Set E2E_EMAIL and E2E_PASSWORD to run this test.');

    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('#email').fill(EMAIL ?? '');
    await page.locator('#password').fill(PASSWORD ?? '');
    await page.locator('button[type="submit"]').click();

    // Wait for redirect away from login
    await page.waitForURL(/\/(?:en|pl|ar)(\/|$)/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 });
  });

  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/en/contractors', { waitUntil: 'domcontentloaded' });

    // Should be redirected to the login page
    await page.waitForURL(/\/en\/login/, { timeout: 20_000 });
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
  });

  test('logout from user menu redirects to login', async ({ page }) => {
    test.skip(!(EMAIL && PASSWORD), 'Set E2E_EMAIL and E2E_PASSWORD to run this test.');

    // Log in first
    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#email').fill(EMAIL ?? '');
    await page.locator('#password').fill(PASSWORD ?? '');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(?:en|pl|ar)(\/|$)/, { timeout: 30_000 });
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    // Open user menu
    const menuTrigger = page.locator("[data-sidebar='menu-button']").last();
    await menuTrigger.click();
    await page.locator('[role="menu"]').waitFor({ state: 'visible', timeout: 10_000 });

    // Click sign out
    const signOut = page.locator('[role="menuitem"]').filter({ hasText: /sign\s*out|log\s*out/i });
    await signOut.click();

    // Expect redirect to login
    await page.waitForURL(/\/en\/login/, { timeout: 20_000 });
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
  });
});
