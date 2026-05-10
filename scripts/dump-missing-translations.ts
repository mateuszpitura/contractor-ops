#!/usr/bin/env tsx
/**
 * Companion to audit-translations.ts: emits the full set of missing
 * (key → base-locale value) pairs for each non-base locale, so a fixup
 * pass has every English string at hand and can write translations
 * inline without re-resolving paths.
 *
 * Writes one JSON file per (app, locale) under .planning/translations/
 * shaped as:
 *
 *   {
 *     "Some.Namespace.dotted.path": "English value",
 *     ...
 *   }
 *
 * Usage:
 *   pnpm tsx scripts/dump-missing-translations.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
];

function flatten(
  obj: unknown,
  prefix = '',
  out: Map<string, string> = new Map(),
): Map<string, string> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object') {
    out.set(prefix, String(obj));
    return out;
  }
  if (Array.isArray(obj)) {
    out.set(prefix, JSON.stringify(obj));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix === '' ? k : `${prefix}.${k}`;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      out.set(next, v == null ? '' : Array.isArray(v) ? JSON.stringify(v) : String(v));
    } else {
      flatten(v, next, out);
    }
  }
  return out;
}

function loadFlat(dir: string, locale: string): Map<string, string> {
  const path = resolve(process.cwd(), dir, `${locale}.json`);
  const raw = readFileSync(path, 'utf-8');
  return flatten(JSON.parse(raw));
}

const outDir = resolve(process.cwd(), '.planning/translations');
mkdirSync(outDir, { recursive: true });

for (const set of LOCALE_SETS) {
  const base = loadFlat(set.dir, set.baseLocale);
  for (const locale of set.locales) {
    if (locale === set.baseLocale) continue;
    const target = loadFlat(set.dir, locale);
    const missing: Record<string, string> = {};
    for (const [key, value] of base) {
      if (!target.has(key)) missing[key] = value;
    }
    const file = resolve(outDir, `${set.app.replaceAll('/', '_')}-${locale}-missing.json`);
    writeFileSync(file, JSON.stringify(missing, null, 2));
    console.log(`${set.app} ${locale}: ${Object.keys(missing).length} missing → ${file}`);
  }
}
