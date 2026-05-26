import { expect, test } from '@playwright/test';

import { localePath } from './helpers';

/**
 * Registration flow — Step 13 batch 4 port from apps/web/e2e/functional/register.spec.ts
 * Fresh browser context (no stored auth). Routes: /:locale/register (Vite SPA).
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Register', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(localePath('/register'), { waitUntil: 'domcontentloaded' });
  });

  test('register page renders with form', async ({ page }) => {
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 15_000 });
  });

  test('org name input exists', async ({ page }) => {
    const orgInput = page
      .locator(
        'input[name="orgName"], input[name="organizationName"], input[name="org_name"], input[name="companyName"], input[name="company"]',
      )
      .or(
        page.locator(
          'input[id="organizationName"], input[id="orgName"], input[id="org_name"], input[id="companyName"], input[id="company"]',
        ),
      )
      .or(
        page.locator('label:has-text("organization"i) + input, label:has-text("company"i) + input'),
      )
      .or(page.locator('input[id$="-orgName"]'));

    await expect(orgInput.first()).toBeVisible({ timeout: 15_000 });
  });

  test('email input exists', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"], input#email');

    await expect(emailInput.first()).toBeVisible({ timeout: 15_000 });
  });

  test('password input exists', async ({ page }) => {
    const passwordInput = page.locator(
      'input[type="password"], input[name="password"], input#password',
    );

    await expect(passwordInput.first()).toBeVisible({ timeout: 15_000 });
  });

  test('submit button exists', async ({ page }) => {
    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Register"), button:has-text("Sign up"), button:has-text("Create account"), button:has-text("Utwórz organizacj")',
    );

    await expect(submitButton.first()).toBeVisible({ timeout: 15_000 });
  });

  test('invalid form shows validation errors', async ({ page }) => {
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 15_000 });

    const submitButton = page.locator(
      'button[type="submit"], button:has-text("Register"), button:has-text("Sign up"), button:has-text("Create account"), button:has-text("Utwórz organizacj")',
    );
    await submitButton.first().click();

    const validationError = page.locator(
      '[role="alert"], [aria-invalid="true"], .text-destructive, .text-red-500, [data-sonner-toast], form p.text-destructive, [data-error]',
    );

    await expect(validationError.first()).toBeVisible({ timeout: 10_000 });
  });
});
