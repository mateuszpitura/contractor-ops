import { expect, test } from '@playwright/test';

import { localePath, PORTAL_LOGIN_PATTERN } from './helpers';

/**
 * Contractor portal login page tests — batch 5 port from apps/web/e2e/functional/portal.spec.ts
 *
 * Portal uses magic-link auth (portal_session cookie), separate from dashboard session.
 * Fresh browser context — no stored dashboard or portal session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Portal login', () => {
  test('login page renders with heading', async ({ page }) => {
    await page.goto(localePath('/portal/login'), { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 15_000 });
    await expect(heading).toHaveCSS('font-size', '28px');
  });

  test('email input is present', async ({ page }) => {
    await page.goto(localePath('/portal/login'), { waitUntil: 'domcontentloaded' });

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await expect(emailInput).toBeEnabled();
  });

  test('send magic link button exists', async ({ page }) => {
    await page.goto(localePath('/portal/login'), { waitUntil: 'domcontentloaded' });

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible({ timeout: 15_000 });
    await expect(submitButton).toBeEnabled();
  });

  test('empty email submission shows validation error', async ({ page }) => {
    await page.goto(localePath('/portal/login'), { waitUntil: 'domcontentloaded' });
    await page.locator('button[type="submit"]').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('button[type="submit"]').click();

    const errorText = page.locator('.text-destructive').first();
    await expect(errorText).toBeVisible({ timeout: 10_000 });
  });

  test('unauthenticated portal access redirects to login', async ({ page }) => {
    await page.goto(localePath('/portal/contracts'), { waitUntil: 'domcontentloaded' });

    await page.waitForURL(PORTAL_LOGIN_PATTERN, { timeout: 20_000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
  });
});
