/**
 * Flat screenshot path helpers — `{index}-{routeId}-{viewport}-{theme}[-{variant}].png`
 */

import { resolve } from 'node:path';
import type { Locale, Theme } from './routes.js';

export function formatIndex(n: number): string {
  return String(n).padStart(3, '0');
}

export interface ScreenshotNameInput {
  routeId: string;
  viewport: string;
  theme: Theme;
  /** Optional suffix after theme, hyphen-separated (e.g. `modal-filters`, `broken`). */
  variant?: string;
}

export function buildScreenshotFilename(index: number, input: ScreenshotNameInput): string {
  const parts = [formatIndex(index), input.routeId, input.viewport, input.theme];
  if (input.variant && input.variant !== 'default') {
    parts.push(input.variant);
  }
  return `${parts.join('-')}.png`;
}

export function buildScreenshotPath(
  outDir: string,
  locale: Locale,
  index: number,
  input: ScreenshotNameInput,
): string {
  return resolve(outDir, locale, buildScreenshotFilename(index, input));
}

/** Baseline key without locale prefix or index — `web-approvals-desktop-light`. */
export function buildBaselineKey(input: Omit<ScreenshotNameInput, 'variant'>): string {
  return `${input.routeId}-${input.viewport}-${input.theme}`;
}

export function comboKey(parts: {
  routeId: string;
  locale: Locale;
  viewport: string;
  theme: Theme;
  walkState?: string;
}): string {
  return `${parts.routeId}|${parts.locale}|${parts.viewport}|${parts.theme}|${parts.walkState ?? 'default'}`;
}

export function parseBaselineKey(key: string): {
  routeId: string;
  viewport: string;
  theme: Theme;
} | null {
  const m = /^(.+)-(mobile|tablet|desktop)-(light|dark)$/.exec(key);
  if (!m) return null;
  return { routeId: m[1]!, viewport: m[2]!, theme: m[3] as Theme };
}

/** Parse flat screenshot filename (with or without locale dir). */
export function parseScreenshotFilename(filename: string): {
  index: number;
  routeId: string;
  viewport: string;
  theme: Theme;
  variant: string;
} | null {
  const base = filename.replace(/^.*\//, '').replace(/\.png$/i, '');
  const m = /^(\d{3})-(.+)-(mobile|tablet|desktop)-(light|dark)(?:-(.+))?$/.exec(base);
  if (!m) return null;
  return {
    index: Number.parseInt(m[1]!, 10),
    routeId: m[2]!,
    viewport: m[3]!,
    theme: m[4] as Theme,
    variant: m[5] ?? 'default',
  };
}

/** One index per matrix combo per locale; reuse for page + modal variants. */
export class ShotIndexRegistry {
  private readonly byLocale = new Map<Locale, Map<string, number>>();
  private counters = new Map<Locale, number>();

  getIndex(locale: Locale, key: string): number {
    let map = this.byLocale.get(locale);
    if (!map) {
      map = new Map();
      this.byLocale.set(locale, map);
    }
    const existing = map.get(key);
    if (existing !== undefined) return existing;
    const next = (this.counters.get(locale) ?? 0) + 1;
    this.counters.set(locale, next);
    map.set(key, next);
    return next;
  }
}
