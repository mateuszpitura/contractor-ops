/**
 * Optional pixel baseline compare vs goals/qa-walk-and-fix/baselines/
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { buildBaselineKey } from './paths.js';
import type { Locale, Theme } from './routes.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINES_ROOT = resolve(HERE, 'baselines');

export interface VisualCompareResult {
  matched: boolean;
  diffPath?: string;
  message?: string;
}

export function baselinePath(
  locale: Locale,
  routeId: string,
  viewport: string,
  theme: Theme,
): string {
  const key = buildBaselineKey({ routeId, viewport, theme });
  return resolve(BASELINES_ROOT, locale, `${key}.png`);
}

export async function compareOrUpdateBaseline(
  _page: Page,
  opts: {
    locale: Locale;
    routeId: string;
    viewport: string;
    theme: Theme;
    screenshotPath: string;
    updateBaselines: boolean;
    compareBaseline: boolean;
  },
): Promise<VisualCompareResult> {
  if (!(opts.compareBaseline || opts.updateBaselines)) {
    return { matched: true };
  }

  const target = baselinePath(opts.locale, opts.routeId, opts.viewport, opts.theme);
  await mkdir(dirname(target), { recursive: true });

  if (opts.updateBaselines) {
    const buf = await readFile(opts.screenshotPath);
    await writeFile(target, buf);
    return { matched: true, message: 'baseline updated' };
  }

  try {
    const expected = await readFile(target);
    const actual = await readFile(opts.screenshotPath);
    if (expected.length === actual.length && Buffer.compare(expected, actual) === 0) {
      return { matched: true };
    }
    const diffPath = opts.screenshotPath.replace(/\.png$/, '-diff.png');
    await writeFile(diffPath, actual);
    return {
      matched: false,
      diffPath,
      message: `Pixel baseline mismatch for ${buildBaselineKey(opts)}`,
    };
  } catch {
    return { matched: true, message: 'no baseline yet — skipped compare' };
  }
}
