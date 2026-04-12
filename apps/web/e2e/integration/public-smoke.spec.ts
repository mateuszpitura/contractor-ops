import { expect, test } from '@playwright/test';

/**
 * Always-on smoke (no env flags). Requires dev server at E2E_WEB_URL / baseURL.
 * Complements optional Resend webhook test and perf suite.
 */
test.describe('Public smoke', () => {
  test('login page shows email field', async ({ page }) => {
    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#email')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#password')).toBeVisible();
  });

  test('localized root responds', async ({ request }) => {
    const res = await request.get('/en/login', { maxRedirects: 5 });
    expect(res.ok()).toBe(true);
  });
});
