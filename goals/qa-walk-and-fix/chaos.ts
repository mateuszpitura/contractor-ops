/**
 * Chaos / human-like pass — second lightweight probe per route.
 */

import type { BrowserContext } from 'playwright';
import type { MatrixEntry } from './walk-types.js';
import { buildUrl } from './walk-types.js';

export interface ChaosFinding {
  cluster: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  message: string;
}

export async function runChaosProbe(
  context: BrowserContext,
  entry: MatrixEntry,
  routeTimeoutMs: number,
): Promise<ChaosFinding[]> {
  const findings: ChaosFinding[] = [];
  const page = await context.newPage();
  const { url } = buildUrl(entry.route, entry.locale);

  try {
    await page.setViewportSize({ width: entry.viewport.width, height: entry.viewport.height });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: routeTimeoutMs });

    const cta = page.getByRole('button').first();
    for (let i = 0; i < 3; i++) {
      await cta.click({ timeout: 500 }).catch(() => {
        /* noop */
      });
      await page.waitForTimeout(80);
    }

    if (entry.locale === 'en') {
      const arUrl = url.replace('/en/', '/ar/');
      await page
        .goto(arUrl, { waitUntil: 'domcontentloaded', timeout: routeTimeoutMs })
        .catch(() => {
          /* noop */
        });
      const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
      if (dir !== 'rtl') {
        findings.push({
          cluster: 'chaos',
          severity: 'high',
          message: 'Locale switch en→ar did not set dir=rtl',
        });
      }
    }

    await page.goBack({ timeout: 5000 }).catch(() => {
      /* noop */
    });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: routeTimeoutMs }).catch(() => {
      /* noop */
    });
  } catch (err) {
    findings.push({
      cluster: 'chaos',
      severity: 'medium',
      message: `Chaos probe error: ${(err as Error).message}`,
    });
  } finally {
    await page.close();
  }

  return findings;
}
