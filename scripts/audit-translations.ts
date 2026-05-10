#!/usr/bin/env tsx
/**
 * Translation completeness audit — workplan §5.1.
 *
 * Loads every locale JSON for apps/web and apps/landing, computes the
 * flat dot-key set per locale, and prints a report of:
 *   - keys present in en but missing from pl/de/ar (untranslated)
 *   - keys present in pl/de/ar but missing from en (orphans)
 *
 * Exits non-zero when any non-en locale is missing keys from en, so CI
 * can catch translation drift before the user sees a missing-string bug.
 *
 * Usage:
 *   pnpm tsx scripts/audit-translations.ts
 *
 * Wire into CI later as a separate step alongside typecheck/lint.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface LocaleSet {
  app: string;
  dir: string;
  locales: ReadonlyArray<string>;
  baseLocale: string;
}

const LOCALE_SETS: ReadonlyArray<LocaleSet> = [
  {
    app: 'apps/web',
    dir: 'apps/web/messages',
    locales: ['en', 'pl', 'de', 'ar'],
    baseLocale: 'en',
  },
  {
    app: 'apps/landing',
    dir: 'apps/landing/src/i18n/locales',
    locales: ['en', 'pl', 'de', 'ar'],
    baseLocale: 'en',
  },
];

function flatten(obj: unknown, prefix = ''): ReadonlySet<string> {
  const out = new Set<string>();
  if (obj === null || typeof obj !== 'object') {
    if (prefix !== '') out.add(prefix);
    return out;
  }
  if (Array.isArray(obj)) {
    if (prefix !== '') out.add(prefix);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix === '' ? k : `${prefix}.${k}`;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      out.add(next);
    } else {
      for (const child of flatten(v, next)) out.add(child);
    }
  }
  return out;
}

function loadLocale(dir: string, locale: string): ReadonlySet<string> {
  const path = resolve(process.cwd(), dir, `${locale}.json`);
  const raw = readFileSync(path, 'utf-8');
  return flatten(JSON.parse(raw));
}

interface DiffReport {
  app: string;
  baseLocale: string;
  perLocale: ReadonlyArray<{
    locale: string;
    missing: ReadonlyArray<string>;
    extra: ReadonlyArray<string>;
  }>;
  totalMissing: number;
}

function audit(set: LocaleSet): DiffReport {
  const baseKeys = loadLocale(set.dir, set.baseLocale);
  let totalMissing = 0;
  const perLocale = set.locales
    .filter(l => l !== set.baseLocale)
    .map(locale => {
      const localeKeys = loadLocale(set.dir, locale);
      const missing = [...baseKeys].filter(k => !localeKeys.has(k)).sort();
      const extra = [...localeKeys].filter(k => !baseKeys.has(k)).sort();
      totalMissing += missing.length;
      return { locale, missing, extra };
    });
  return { app: set.app, baseLocale: set.baseLocale, perLocale, totalMissing };
}

function format(report: DiffReport): string {
  const lines: string[] = [];
  lines.push(`\n━━━ ${report.app} ━━━`);
  lines.push(`base: ${report.baseLocale}`);
  for (const { locale, missing, extra } of report.perLocale) {
    lines.push('');
    lines.push(`  ${locale}:`);
    if (missing.length === 0 && extra.length === 0) {
      lines.push('    ✓ in sync with base');
      continue;
    }
    if (missing.length > 0) {
      lines.push(
        `    ⚠ ${missing.length} key(s) missing (present in ${report.baseLocale}, absent here):`,
      );
      for (const k of missing.slice(0, 25)) lines.push(`      - ${k}`);
      if (missing.length > 25) lines.push(`      … and ${missing.length - 25} more`);
    }
    if (extra.length > 0) {
      lines.push(
        `    ⚠ ${extra.length} orphan key(s) (present here, absent in ${report.baseLocale}):`,
      );
      for (const k of extra.slice(0, 25)) lines.push(`      + ${k}`);
      if (extra.length > 25) lines.push(`      … and ${extra.length - 25} more`);
    }
  }
  return lines.join('\n');
}

let totalMissing = 0;
for (const set of LOCALE_SETS) {
  const report = audit(set);
  process.stdout.write(format(report));
  process.stdout.write('\n');
  totalMissing += report.totalMissing;
}

process.stdout.write('\n━━━ summary ━━━\n');
if (totalMissing === 0) {
  process.stdout.write('✓ all locales in sync with their base.\n');
  process.exit(0);
}
process.stdout.write(`⚠ ${totalMissing} key(s) missing across all non-base locales.\n`);
process.stdout.write('Add the missing translations or note them as known gaps.\n');
process.exit(1);
