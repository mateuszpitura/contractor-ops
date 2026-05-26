import { expect, test } from '@playwright/test';

import { E2E_LOCALE } from '../functional/helpers';

/**
 * Public route — no session. Complements dashboard perf when E2E_* are unset.
 *
 * Ported from apps/web/e2e/perf/login-public.spec.ts. The Vite login form
 * uses dynamic React `useId()` values rather than literal `#email` / `#password`
 * ids, so we target the underlying input types.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('perf — public login page', () => {
  test('login form visible', async ({ page }) => {
    const t0 = Date.now();
    await page.goto(`/${E2E_LOCALE}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('input[type="password"]').waitFor({ state: 'visible' });
    const durationMs = Date.now() - t0;
    expect(durationMs).toBeLessThan(60_000);
  });
});
