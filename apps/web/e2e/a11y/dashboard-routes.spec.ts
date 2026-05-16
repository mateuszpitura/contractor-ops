import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * WCAG 2.2 AA accessibility gate — Phase C.4.a.
 *
 * Runs @axe-core/playwright against the top-10 authenticated dashboard routes
 * (same set used by C.5 boundary coverage). Serious / critical violations fail
 * the test unless allowlisted with an unexpired entry in `.axe-allowlist.json`
 * at the repo root.
 *
 * Auth: reuses the storageState produced by `e2e/functional/global-setup.ts`
 * (already wired via the parent config's `use.storageState`). When
 * `E2E_EMAIL` / `E2E_PASSWORD` are unset, global-setup writes an empty
 * storage file and the route navigation redirects to `/login`; we detect
 * that and `test.skip()` rather than failing — matches the functional
 * `skipIfUnauthenticated` pattern.
 *
 * Allowlist file shape (root `.axe-allowlist.json`):
 *   {
 *     "<route>": [
 *       { "id": "<axe-rule-id>", "expiresAt": "YYYY-MM-DD", "note": "..." }
 *     ]
 *   }
 * Expired entries are ignored — they become hard failures so violations
 * cannot rot in the allowlist forever.
 */

const ROUTES = [
  '/dashboard',
  '/contractors',
  '/contracts',
  '/invoices',
  '/payments',
  '/approvals',
  '/equipment',
  '/workflows',
  '/settings',
  '/admin',
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
    // Navigate via a locale-prefixed URL (the app routes everything under
    // /[locale]/...). The middleware redirects bare /<route> to /en/<route>
    // when no locale cookie is set, so this stays robust either way.
    await page.goto(`/en${route}`, { waitUntil: 'domcontentloaded' });

    // Skip gracefully when no auth session is available (mirrors
    // skipIfUnauthenticated in e2e/functional/helpers.ts).
    test.skip(
      page.url().includes('/login'),
      'Set E2E_EMAIL and E2E_PASSWORD so global setup can log in.',
    );

    // Let the dashboard shell + initial data settle before scanning.
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
      // networkidle can be flaky on dashboards with long-poll telemetry;
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
