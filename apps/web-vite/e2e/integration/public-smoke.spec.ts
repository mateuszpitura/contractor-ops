import { expect, test } from '@playwright/test';

import { E2E_LOCALE } from '../functional/helpers';

/**
 * Always-on smoke (no env flags). Requires the web-vite preview server
 * (Playwright `webServer` starts it on :4173). Ported from
 * apps/web/e2e/integration/public-smoke.spec.ts (Step 13).
 *
 * Locale switched from legacy `/en` to `/pl` (DEFAULT_LOCALE in the new
 * SPA — see apps/web-vite/e2e/functional/helpers.ts).
 *
 * The web-vite login form uses `useId()`-generated input ids, so the
 * legacy `#email` / `#password` selectors don't apply. We target the
 * inputs by `name` (set by react-hook-form `register('email'|'password')`)
 * and by `type="password"` — both are stable across the form.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Public smoke', () => {
  test('login page shows email and password fields', async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}/login`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('localized root responds', async ({ request }) => {
    const res = await request.get(`/${E2E_LOCALE}/login`, { maxRedirects: 5 });
    expect(res.ok()).toBe(true);
  });
});
