import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { E2E_LOCALE } from '../functional/helpers';

/**
 * WCAG 2.2 AA accessibility gate — Vite SPA port.
 *
 * Scans the top-10 authenticated dashboard routes with @axe-core/playwright.
 * Serious / critical violations fail the test unless allow-listed (with an
 * unexpired entry) in `.axe-allowlist.json` at the repo root.
 *
 * Auth: reuses the storageState produced by
 * `e2e/functional/global-setup.ts` (wired via the parent config's
 * `use.storageState`). When auth env is unset, global-setup writes an
 * empty storage file and we land on `/login` — skip rather than fail,
 * matching `skipIfUnauthenticated` in functional helpers.
 *
 * Allowlist file shape (root `.axe-allowlist.json`):
 *   {
 *     "<route>": [
 *       { "id": "<axe-rule-id>", "expiresAt": "YYYY-MM-DD", "note": "..." }
 *     ]
 *   }
 * Expired entries are ignored so violations can't rot in the allowlist.
 *
 * Web-vite shape notes:
 * - Dashboard index is the locale root (no `/dashboard` path).
 * - Admin route is `/admin/boe-rate` (no bare `/admin`).
 */

const ROUTES = [
  '',
  '/contractors',
  '/contracts',
  '/invoices',
  '/payments',
  '/approvals',
  '/equipment',
  '/workflows',
  '/settings',
  '/admin/boe-rate',
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
  test(`a11y: ${route || '/'} has no serious/critical WCAG 2.2 AA violations`, async ({ page }) => {
    await page.goto(`/${E2E_LOCALE}${route}`, { waitUntil: 'domcontentloaded' });

    // Skip gracefully when no auth session is available
    // (mirrors skipIfUnauthenticated in e2e/functional/helpers.ts).
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
