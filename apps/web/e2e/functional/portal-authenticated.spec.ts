import { expect, test } from '@playwright/test';

/**
 * Portal auth-guard smoke tests.
 *
 * Every protected portal route must redirect unauthenticated users to the
 * portal login page. Since portal auth relies on magic links (portal_session
 * cookie) that cannot be automated in E2E without a test bypass, these tests
 * verify the auth guard behaviour by confirming each route redirects to login.
 *
 * Uses a fresh browser context — no stored dashboard or portal session.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const PORTAL_LOGIN_PATTERN = /\/en\/portal\/login/;

const protectedRoutes = [
  { path: '/en/portal', label: 'portal root' },
  { path: '/en/portal/contracts', label: 'contracts' },
  { path: '/en/portal/invoices', label: 'invoices' },
  { path: '/en/portal/time', label: 'time tracking' },
  { path: '/en/portal/documents', label: 'documents' },
  { path: '/en/portal/equipment', label: 'equipment' },
  { path: '/en/portal/payments', label: 'payments' },
  { path: '/en/portal/settings', label: 'settings' },
] as const;

test.describe('Portal auth guard', () => {
  for (const { path, label } of protectedRoutes) {
    test(`${label} (${path}) redirects to portal login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      await page.waitForURL(PORTAL_LOGIN_PATTERN, { timeout: 20_000 });
      await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    });
  }
});
