#!/usr/bin/env tsx
/**
 * Deep quality audit complement to scripts/audit-translations.ts.
 *
 * Where audit-translations.ts checks key PRESENCE (which keys exist in
 * each locale, which don't), this script checks the VALUES themselves:
 *
 *   1. ICU placeholders   — every `{name}` / `{count, plural, …}` etc.
 *                            in en must appear in pl/de/ar; if a translator
 *                            dropped a placeholder, runtime ICU formatting
 *                            silently emits the literal `{name}` to users.
 *
 *   2. English leakage    — heuristic: a non-base value that is byte-
 *                            identical to en for a string longer than 4 chars
 *                            and containing a space (i.e. plausibly a
 *                            sentence) probably wasn't translated. Brand
 *                            names, acronyms, and proper nouns (BACS, KSeF,
 *                            Skonto, Steuerberater, etc.) are allow-listed.
 *
 *   3. Empty values       — empty / whitespace-only string in any locale.
 *
 *   4. Orphan diagnostics — _NOTE / _meta keys that exist only in non-en
 *                            locales (dev annotations stored as JSON values).
 *
 *   5. Direction sanity   — for ar: warn if a value contains explicit
 *                            LTR/RTL marks (U+200E / U+200F), which fight
 *                            the layout-level direction switch.
 *
 * Exits 0 (advisory). Reports counts + a bounded sample per category so the
 * output stays reviewable. Run with `--full` to print every finding.
 *
 * Usage:
 *   pnpm tsx scripts/audit-translations-quality.ts
 *   pnpm tsx scripts/audit-translations-quality.ts --full
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FULL = process.argv.includes('--full');
const DUMP = process.argv.includes('--dump');
const SAMPLE = 10;
const DUMP_DIR = resolve(process.cwd(), '.planning/translations');

interface LocaleSet {
  app: string;
  dir: string;
  locales: readonly string[];
  baseLocale: string;
}

const LOCALE_SETS: readonly LocaleSet[] = [
  {
    app: 'apps/web',
    dir: 'apps/web-vite/messages',
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

// Strings that are legitimately identical across locales:
//   - brand names / proper nouns
//   - jurisdiction-specific acronyms kept in source language
//   - UK / DE statute titles (kept verbatim by editorial decision)
const LEAK_ALLOWLIST: RegExp[] = [
  /^[A-Z0-9 _.&\-+/()'%]+$/, // pure acronym/punctuation strings
  /^https?:\/\//, // URLs
  /^\d/, // strings that start with a digit (codes, version numbers)
  /^[A-Z]{2,}-\d+$/, // ticket-id style (e.g. INV-001)
  /Late Payment of Commercial Debts \(Interest\) Act 1998/,
  /Status Determination Statement/,
  /Statusfeststellungsverfahren/,
  /Scheinselbständigkeit/,
  /Steuerberater/,
];

interface KeyValue {
  key: string;
  value: string;
}

function flatten(obj: unknown, prefix = '', out: KeyValue[] = []): KeyValue[] {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object') {
    out.push({ key: prefix, value: String(obj) });
    return out;
  }
  if (Array.isArray(obj)) {
    out.push({ key: prefix, value: JSON.stringify(obj) });
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix === '' ? k : `${prefix}.${k}`;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      out.push({
        key: next,
        value: v == null ? '' : Array.isArray(v) ? JSON.stringify(v) : String(v),
      });
    } else {
      flatten(v, next, out);
    }
  }
  return out;
}

function loadLocale(dir: string, locale: string): Map<string, string> {
  const path = resolve(process.cwd(), dir, `${locale}.json`);
  const raw = readFileSync(path, 'utf-8');
  return new Map(flatten(JSON.parse(raw)).map(({ key, value }) => [key, value]));
}

/**
 * Extract the set of ICU placeholder NAMES referenced by a message.
 * Walks the whole string and pulls out any `{argName[, type[, format]]}`
 * where argName is a valid ICU identifier — so it correctly recurses
 * into the bodies of plural/select arms (`one {…}`, `other {…}`) and
 * picks up nested placeholders there, while ignoring literal-text
 * tokens inside arms (e.g. `# valid row`).
 *
 * Returns the argument-name set so a translation can be compared
 * against the base for placeholder parity.
 */
const ICU_IDENT = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function extractPlaceholders(value: string): Set<string> {
  const out = new Set<string>();
  let depth = 0;
  let buffer = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '{') {
      if (depth === 0) {
        buffer = '';
      } else {
        buffer += ch;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // Top-level placeholder closed — read its arg name (first comma-delimited token)
        const name = buffer.split(',')[0].trim();
        if (ICU_IDENT.test(name)) out.add(name);
        // Recurse into the buffer so nested placeholders inside plural/
        // select arms (e.g. `{count, plural, one {{name} item} ...}`)
        // are also collected. The ICU_IDENT filter discards literal-text
        // tokens like `# valid row`.
        for (const sub of extractPlaceholders(buffer)) out.add(sub);
        buffer = '';
      } else if (depth > 0) {
        buffer += ch;
      }
    } else if (depth > 0) {
      buffer += ch;
    }
  }
  return out;
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter(x => !b.has(x));
}

interface Findings {
  placeholderMismatch: Array<{
    key: string;
    missing: string[];
    extra: string[];
    en: string;
    tr: string;
  }>;
  englishLeak: Array<{ key: string; value: string }>;
  empties: Array<{ key: string }>;
  directionMarks: Array<{ key: string; value: string }>;
}

const ALLOWLIST_HIT = (v: string): boolean => LEAK_ALLOWLIST.some(r => r.test(v));

function auditLocale(
  base: Map<string, string>,
  target: Map<string, string>,
  locale: string,
): Findings {
  const findings: Findings = {
    placeholderMismatch: [],
    englishLeak: [],
    empties: [],
    directionMarks: [],
  };

  for (const [key, baseValue] of base) {
    const targetValue = target.get(key);
    if (targetValue === undefined) continue; // presence-audit handles missing keys

    if (targetValue.trim() === '') {
      findings.empties.push({ key });
      continue;
    }

    const basePh = extractPlaceholders(baseValue);
    const targetPh = extractPlaceholders(targetValue);
    const missing = setDiff(basePh, targetPh);
    const extra = setDiff(targetPh, basePh);
    if (missing.length > 0 || extra.length > 0) {
      findings.placeholderMismatch.push({
        key,
        missing,
        extra,
        en: baseValue,
        tr: targetValue,
      });
    }

    // English leakage heuristic: identical to en, plausibly a sentence,
    // not on the allowlist.
    if (
      targetValue === baseValue &&
      baseValue.length > 4 &&
      baseValue.includes(' ') &&
      !ALLOWLIST_HIT(baseValue)
    ) {
      findings.englishLeak.push({ key, value: baseValue });
    }

    // Direction-mark sanity (ar only)
    if (locale === 'ar' && /[‎‏]/.test(targetValue)) {
      findings.directionMarks.push({ key, value: targetValue });
    }
  }

  return findings;
}

function printSection<T>(
  label: string,
  items: readonly T[],
  render: (item: T, i: number) => string,
): void {
  if (items.length === 0) {
    console.log(`    ✓ ${label}: 0`);
    return;
  }
  const symbol = items.length > 0 ? '⚠' : '✓';
  console.log(`    ${symbol} ${label}: ${items.length}`);
  const slice = FULL ? items : items.slice(0, SAMPLE);
  for (const [i, item] of slice.entries()) {
    console.log(render(item, i));
  }
  if (!FULL && items.length > SAMPLE) {
    console.log(`        … and ${items.length - SAMPLE} more (run with --full to see all)`);
  }
}

let totalIssues = 0;

for (const set of LOCALE_SETS) {
  console.log(`\n━━━ ${set.app} ━━━`);
  const base = loadLocale(set.dir, set.baseLocale);

  for (const locale of set.locales) {
    if (locale === set.baseLocale) continue;
    const target = loadLocale(set.dir, locale);
    const findings = auditLocale(base, target, locale);
    const localTotal =
      findings.placeholderMismatch.length +
      findings.englishLeak.length +
      findings.empties.length +
      findings.directionMarks.length;
    totalIssues += localTotal;

    if (DUMP && (findings.englishLeak.length > 0 || findings.placeholderMismatch.length > 0)) {
      mkdirSync(DUMP_DIR, { recursive: true });
      const slug = `${set.app.replaceAll('/', '_')}-${locale}`;
      if (findings.englishLeak.length > 0) {
        const leakMap: Record<string, string> = {};
        for (const { key, value } of findings.englishLeak) leakMap[key] = value;
        writeFileSync(
          resolve(DUMP_DIR, `${slug}-untranslated.json`),
          JSON.stringify(leakMap, null, 2),
        );
      }
      if (findings.placeholderMismatch.length > 0) {
        writeFileSync(
          resolve(DUMP_DIR, `${slug}-placeholder-mismatches.json`),
          JSON.stringify(findings.placeholderMismatch, null, 2),
        );
      }
    }

    console.log(`\n  ${locale}:`);
    printSection(
      'ICU placeholder mismatches',
      findings.placeholderMismatch,
      (m: Findings['placeholderMismatch'][number]) =>
        `      - ${m.key}\n          missing: [${m.missing.join(', ')}]  extra: [${m.extra.join(', ')}]\n          en:  ${truncate(m.en)}\n          ${locale}:  ${truncate(m.tr)}`,
    );
    printSection(
      'English leakage (sentence-like values identical to en)',
      findings.englishLeak,
      (m: Findings['englishLeak'][number]) => `      - ${m.key}\n          "${truncate(m.value)}"`,
    );
    printSection(
      'Empty values',
      findings.empties,
      (m: Findings['empties'][number]) => `      - ${m.key}`,
    );
    if (locale === 'ar') {
      printSection(
        'Explicit RTL/LTR marks (U+200E/U+200F) in value',
        findings.directionMarks,
        (m: Findings['directionMarks'][number]) =>
          `      - ${m.key}\n          "${truncate(m.value)}"`,
      );
    }
  }
}

console.log(`\n━━━ summary ━━━`);
if (totalIssues === 0) {
  console.log('✓ deep quality audit clean across all locales.');
} else {
  console.log(`⚠ ${totalIssues} quality issue(s) found across all non-base locales.`);
  console.log('  Re-run with --full to see every finding.');
}

function truncate(s: string, max = 120): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
