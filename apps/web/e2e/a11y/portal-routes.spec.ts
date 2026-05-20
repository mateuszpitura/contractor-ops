import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * WCAG 2.2 AA accessibility gate for the contractor portal — Portal UI Polish.
 *
 * Mirrors `dashboard-routes.spec.ts` for the `(portal)` route group. Every
 * portal-facing route must report zero serious/critical violations unless
 * allow-listed (with an unexpired entry) in the root `.axe-allowlist.json`.
 *
 * Auth: depends on the portal session storage state produced by global setup
 * (env: `E2E_PORTAL_EMAIL` / `E2E_PORTAL_MAGIC_TOKEN`, or whatever the
 * portal smoke fixture provides). When the cookie is absent we land on
 * `/portal/login` and skip the scan — same pattern as the dashboard gate.
 */

const ROUTES = [
  '/portal',
  '/portal/contracts',
  '/portal/invoices',
  '/portal/documents',
  '/portal/time',
  '/portal/equipment',
  '/portal/payments',
  '/portal/settings',
] as const;

type AllowlistEntry = { id: string; expiresAt: string; note?: string };
type Allowlist = Record<string, AllowlistEntry[]>;

const ALLOWLIST_PATH = join(process.cwd(), '..', '..', '.axe-allowlist.json');

function loadAllowlist(): Allowlist {
  try {
    return JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as Allowlist;
  } catch {
    return {};
  }
}

const allowlist = loadAllowlist();
const today = new Date().toISOString().slice(0, 10);

for (const route of ROUTES) {
  test(`a11y: ${route} has no serious/critical WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(`/en${route}`, { waitUntil: 'domcontentloaded' });

    test.skip(
      page.url().includes('/portal/login'),
      'Portal session cookie missing — set the portal E2E fixture to enable this gate.',
    );

    await page.locator('#portal-content').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
      // networkidle can flake on dashboards with long-polling subscriptions;
      // proceed with the scan anyway.
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const routeAllowlist = (allowlist[route] ?? []).filter(entry => entry.expiresAt > today);
    const allowedIds = new Set(routeAllowlist.map(entry => entry.id));

    const blocking = results.violations.filter(
      violation =>
        (violation.impact === 'serious' || violation.impact === 'critical') &&
        !allowedIds.has(violation.id),
    );

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}
