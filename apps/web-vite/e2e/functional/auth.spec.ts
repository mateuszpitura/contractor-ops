import { expect, test } from '@playwright/test';

/**
 * Authentication flow tests — Step 13 batch 1 port from apps/web/e2e/functional/auth.spec.ts
 * Adapted for the Vite SPA + Fastify API stack (locale-prefixed routes unchanged).
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

    await page.waitForURL(/\/(?:en|pl|ar|de)(\/|$)/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 });
  });

  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/en/contractors', { waitUntil: 'domcontentloaded' });

    await page.waitForURL(/\/en\/login/, { timeout: 20_000 });
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
  });

  test('logout from user menu redirects to login', async ({ page }) => {
    test.skip(!(EMAIL && PASSWORD), 'Set E2E_EMAIL and E2E_PASSWORD to run this test.');

    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#email').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#email').fill(EMAIL ?? '');
    await page.locator('#password').fill(PASSWORD ?? '');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(?:en|pl|ar|de)(\/|$)/, { timeout: 30_000 });
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 20_000 });

    const menuTrigger = page.locator('[data-sidebar="menu-button"]').last();
    await menuTrigger.click();
    await page.locator('[role="menu"]').waitFor({ state: 'visible', timeout: 10_000 });

    const signOut = page.locator('[role="menuitem"]').filter({ hasText: /sign\s*out|log\s*out/i });
    await signOut.click();

    await page.waitForURL(/\/en\/login/, { timeout: 20_000 });
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
  });
});
