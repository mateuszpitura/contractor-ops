import { expect, test } from '@playwright/test';

import { localePath, PORTAL_LOGIN_PATTERN } from './helpers';

/**
 * Portal auth-guard smoke tests — port from apps/web/e2e/functional/portal-authenticated.spec.ts
 *
 * Protected portal routes must redirect unauthenticated users to portal login.
 * Portal auth uses magic links (portal_session cookie) — not automatable without
 * a test bypass, so these verify auth-guard behaviour via redirect.
 *
 * Uses a fresh browser context — no stored dashboard or portal session.
 *
 * Note: redirect depends on portal session validation. In the Vite SPA, a
 * PortalLayout guard (parity with Next `(portal)/layout.tsx`) must be wired
 * for these to pass end-to-end.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const protectedRoutes = [
  { path: '/portal', label: 'portal root' },
  { path: '/portal/contracts', label: 'contracts' },
  { path: '/portal/invoices', label: 'invoices' },
  { path: '/portal/time', label: 'time tracking' },
  { path: '/portal/documents', label: 'documents' },
  { path: '/portal/payments', label: 'payments' },
  { path: '/portal/settings', label: 'settings' },
] as const;

test.describe('Portal auth guard', () => {
  for (const { path, label } of protectedRoutes) {
    test(`${label} (${path}) redirects to portal login`, async ({ page }) => {
      await page.goto(localePath(path), { waitUntil: 'domcontentloaded' });

      await page.waitForURL(PORTAL_LOGIN_PATTERN, { timeout: 20_000 });
      await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
    });
  }
});
