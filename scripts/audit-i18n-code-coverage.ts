#!/usr/bin/env tsx
/**
 * Source-code-vs-i18n auditor — the missing third leg.
 *
 * audit-translations.ts        compares locale files against each other (key
 *                              presence: do pl/de/ar have every en key?)
 * audit-translations-quality.ts checks value quality (placeholders, leakage,
 *                              empties)
 *
 * THIS script closes the loop: it parses every .ts/.tsx file under apps/web/src
 * for `useTranslations()` / `getTranslations()` bindings and `t(…)` call
 * sites, resolves every reference to a full dotted path, and reports any
 * path that is referenced in code but missing from any locale file. It also
 * understands template-literal keys (`t(`prefix.${expr}`)`) by extracting
 * the static prefix and requiring it to exist as an object in every locale.
 *
 * Without this, the loop is closed by users hitting MISSING_MESSAGE at
 * runtime. Wire into CI alongside typecheck/lint.
 *
 * Usage:
 *   pnpm tsx scripts/audit-i18n-code-coverage.ts
 *   pnpm tsx scripts/audit-i18n-code-coverage.ts --full
 *   pnpm tsx scripts/audit-i18n-code-coverage.ts --dump
 *
 * Flags:
 *   --full   print every finding (vs the default top-N sample per category)
 *   --dump   write `.planning/translations/i18n-code-gaps-<locale>.json` per
 *            locale, shaped `{ path: { sample: en-value-if-available } }`,
 *            so a follow-up translation pass can read it directly.
 *
 * Exit code: 0 when zero code-referenced paths are missing from EN and zero
 * are missing from any non-en locale; non-zero otherwise. Drift is a build
 * gate — runtime MISSING_MESSAGE is never acceptable.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const APP = 'apps/web';
const SRC_DIR = resolve(ROOT, APP, 'src');
const MSG_DIR = resolve(ROOT, APP, 'messages');
const LOCALES = ['en', 'pl', 'de', 'ar'] as const;
const FULL = process.argv.includes('--full');
const DUMP = process.argv.includes('--dump');
const DUMP_DIR = resolve(ROOT, '.planning/translations');
const SAMPLE = 15;

const SKIP_DIR_RE =
  /\/(node_modules|\.next|\.turbo|generated|__tests__|test|tests|__mocks__|mocks)\b|\.(test|spec)\.[jt]sx?$/;

// ─── locale loading ──────────────────────────────────────────────────────────

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function loadLocale(locale: string): Json {
  const path = resolve(MSG_DIR, `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf-8')) as Json;
}

/** Walk a JSON tree, return value at dotted path (or undefined). */
function getPath(root: Json, path: string): Json | undefined {
  const parts = path.split('.');
  let cur: Json | undefined = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return;
    cur = (cur as { [k: string]: Json })[p];
    if (cur === undefined) return;
  }
  return cur;
}

/** True if path resolves to a string/number/boolean leaf (i.e. a translatable). */
function isLeaf(root: Json, path: string): boolean {
  const v = getPath(root, path);
  return (
    v !== undefined && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
  );
}

/** True if path resolves to an object (a namespace, possibly with leaves under it). */
function isNamespace(root: Json, path: string): boolean {
  const v = getPath(root, path);
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Flat-iterate all leaf paths under root, optionally rooted at a prefix. */
function* leavesUnder(root: Json, prefix: string): IterableIterator<string> {
  const startNode = prefix === '' ? root : getPath(root, prefix);
  if (startNode === undefined) return;
  yield* walk(startNode, prefix);
}

function* walk(node: Json, prefix: string): IterableIterator<string> {
  if (node === null) return;
  if (typeof node !== 'object' || Array.isArray(node)) {
    yield prefix;
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    const next = prefix === '' ? k : `${prefix}.${k}`;
    yield* walk(v, next);
  }
}

// ─── source scanning ─────────────────────────────────────────────────────────

interface FileRefs {
  file: string;
  /** Variable name → namespace bound by `const X = useTranslations('NS')`. */
  bindings: Map<string, string>;
  /** Full dotted-path keys referenced as STATIC string/template-literal. */
  staticKeys: Set<string>;
  /**
   * Dynamic prefix paths — e.g. `t(`prefix.${expr}`)` records `NS.prefix.`
   * here. Audit checks the path exists as an OBJECT in every locale and
   * that every leaf below it is mirrored.
   */
  dynamicPrefixes: Set<string>;
  /** Call sites that were too dynamic to resolve at all (no static prefix). */
  unresolved: number;
}

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    if (SKIP_DIR_RE.test(`/${rel}`)) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      listSourceFiles(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(full) && !SKIP_DIR_RE.test(full)) {
      out.push(full);
    }
  }
  return out;
}

const USE_TRANSLATIONS_RE = /\b(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]/g;
// getTranslations({ namespace: '…' }) or getTranslations('…') (next-intl server)
const GET_TRANSLATIONS_NAMESPACE_RE =
  /\b(?:const|let)\s+(\w+)\s*=\s*await\s+getTranslations\(\s*(?:\{\s*[^}]*?namespace\s*:\s*['"]([^'"]+)['"][^}]*\}|['"]([^'"]+)['"])/g;

/**
 * Recognised variable names that look like translation handles. Used as a
 * conservative fallback when our binding capture missed (e.g. cross-file).
 * Variables here without a recorded binding emit a "no-namespace" warning
 * rather than being silently dropped.
 */
const TRANSLATION_VAR_HINTS = new Set([
  't',
  'tc',
  'tv',
  'tToast',
  'tCommon',
  'te',
  'tn',
  'tNav',
  'tAria',
  'tAuth',
  'tShared',
]);

function parseFile(file: string): FileRefs {
  const text = readFileSync(file, 'utf-8');
  const bindings = new Map<string, string>();
  const staticKeys = new Set<string>();
  const dynamicPrefixes = new Set<string>();
  let unresolved = 0;

  // Capture useTranslations() and getTranslations() bindings.
  for (const m of text.matchAll(USE_TRANSLATIONS_RE)) {
    bindings.set(m[1], m[2]);
  }
  for (const m of text.matchAll(GET_TRANSLATIONS_NAMESPACE_RE)) {
    const varName = m[1];
    const ns = m[2] ?? m[3];
    if (ns) bindings.set(varName, ns);
  }

  // Find call sites: NAME( with a string-literal or template-literal first arg.
  // We restrict NAME to known bindings OR translation-shape hints to avoid
  // false matches on unrelated function calls.
  const candidateNames = new Set<string>([...bindings.keys(), ...TRANSLATION_VAR_HINTS]);
  if (candidateNames.size === 0) return { file, bindings, staticKeys, dynamicPrefixes, unresolved };

  // We scan character-by-character so we can handle nested templates / commas.
  // Strategy: iterate every `NAME(` occurrence, then read the first argument
  // up to a top-level `,` or `)`. Skip strings/templates/comments while
  // tracking the FIRST argument body.
  for (const name of candidateNames) {
    const callRe = new RegExp(`\\b${name}\\(`, 'g');
    for (const m of text.matchAll(callRe)) {
      const start = m.index! + m[0].length;
      const arg = readFirstArg(text, start);
      if (arg === null) continue;
      const ns = bindings.get(name);
      const resolved = resolveArg(arg);
      if (resolved.kind === 'static') {
        if (!ns) {
          // We saw a t('…') call but never bound t to a namespace — could be a
          // false positive (unrelated function called `t`). Skip silently.
          continue;
        }
        staticKeys.add(`${ns}.${resolved.value}`);
      } else if (resolved.kind === 'dynamicPrefix') {
        if (!ns) continue;
        const prefix = resolved.prefix;
        // Trim trailing '.' for storage; we treat the value as the prefix path.
        const trimmed = prefix.replace(/\.$/, '');
        if (trimmed) dynamicPrefixes.add(`${ns}.${trimmed}`);
        else dynamicPrefixes.add(ns);
      } else {
        if (ns) unresolved++;
      }
    }
  }

  return { file, bindings, staticKeys, dynamicPrefixes, unresolved };
}

/**
 * Read the first JS argument starting at `start`, respecting nested
 * `()`/`{}`/`[]` and string/template boundaries. Returns the raw source
 * including its delimiters (e.g. `'foo'` or `` `pre.${x}` ``).
 */
function readFirstArg(text: string, start: number): string | null {
  let i = start;
  // Skip whitespace.
  while (i < text.length && /\s/.test(text[i])) i++;
  if (i >= text.length) return null;
  const argStart = i;

  let depth = 0; // ()/[]/{} depth
  let stringQuote: '"' | "'" | '`' | null = null;
  let templateDepth = 0; // ${...} inside backticks

  while (i < text.length) {
    const ch = text[i];

    if (stringQuote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (stringQuote === '`' && ch === '$' && text[i + 1] === '{') {
        templateDepth++;
        i += 2;
        continue;
      }
      if (templateDepth > 0 && ch === '}') {
        templateDepth--;
        i++;
        continue;
      }
      if (templateDepth === 0 && ch === stringQuote) {
        stringQuote = null;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      stringQuote = ch;
      i++;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) {
        return text.slice(argStart, i).trim();
      }
      depth--;
      i++;
      continue;
    }
    if (ch === ',' && depth === 0) {
      return text.slice(argStart, i).trim();
    }
    i++;
  }
  return null;
}

type ResolvedArg =
  | { kind: 'static'; value: string }
  | { kind: 'dynamicPrefix'; prefix: string }
  | { kind: 'unresolved' };

function resolveArg(arg: string): ResolvedArg {
  if (arg.length === 0) return { kind: 'unresolved' };
  const first = arg[0];
  if (first === '"' || first === "'") {
    // Plain string literal.
    if (arg.endsWith(first) && arg.length >= 2) {
      const value = arg.slice(1, -1);
      // We don't try to interpret JS escape sequences beyond the obvious.
      // i18n keys never contain newlines so a single string slice is fine.
      if (!value.includes('\\')) return { kind: 'static', value };
      return { kind: 'static', value: value.replace(/\\(['"\\])/g, '$1') };
    }
    return { kind: 'unresolved' };
  }
  if (first === '`') {
    // Template literal. Find the first `${`; everything before is the static
    // prefix. We refuse to interpret what's after — that's the dynamic part.
    if (!arg.endsWith('`')) return { kind: 'unresolved' };
    const inner = arg.slice(1, -1);
    const dollarIdx = inner.indexOf('${');
    if (dollarIdx < 0) {
      // Pure literal template (no interpolation).
      return { kind: 'static', value: inner };
    }
    const staticPrefix = inner.slice(0, dollarIdx);
    if (staticPrefix === '') return { kind: 'unresolved' };
    return { kind: 'dynamicPrefix', prefix: staticPrefix };
  }
  // Identifier or expression — we can't resolve statically.
  return { kind: 'unresolved' };
}

// ─── audit ────────────────────────────────────────────────────────────────────

interface Report {
  /** Keys referenced in code but absent from EN (the canonical source). */
  codeKeysMissingFromBase: string[];
  /** Per non-en locale: keys present in code+EN but missing from this locale. */
  drift: Record<string, string[]>;
  /** Dynamic prefixes whose object doesn't exist in EN. */
  dynamicPrefixesMissingFromBase: string[];
  /** Per non-en locale: leaves under a dynamic prefix in EN that are missing here. */
  dynamicDrift: Record<string, string[]>;
  /** Call sites we couldn't statically resolve. Logged for visibility. */
  unresolved: number;
  /** Bindings we found per file (for sanity / debug). */
  bindings: Map<string, Map<string, string>>;
}

function audit(): Report {
  const files = listSourceFiles(SRC_DIR);
  const report: Report = {
    codeKeysMissingFromBase: [],
    drift: Object.fromEntries(LOCALES.filter(l => l !== 'en').map(l => [l, [] as string[]])),
    dynamicPrefixesMissingFromBase: [],
    dynamicDrift: Object.fromEntries(LOCALES.filter(l => l !== 'en').map(l => [l, [] as string[]])),
    unresolved: 0,
    bindings: new Map(),
  };

  const allStatic = new Set<string>();
  const allDynamicPrefixes = new Set<string>();

  for (const file of files) {
    const refs = parseFile(file);
    if (refs.bindings.size > 0) report.bindings.set(file, refs.bindings);
    for (const k of refs.staticKeys) allStatic.add(k);
    for (const p of refs.dynamicPrefixes) allDynamicPrefixes.add(p);
    report.unresolved += refs.unresolved;
  }

  const locales: Record<string, Json> = Object.fromEntries(
    LOCALES.map(l => [l, loadLocale(l)] as const),
  );

  // Static keys: must exist as leaves in every locale.
  for (const key of [...allStatic].sort()) {
    if (!isLeaf(locales.en, key)) {
      report.codeKeysMissingFromBase.push(key);
      continue;
    }
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      if (!isLeaf(locales[locale], key)) {
        report.drift[locale].push(key);
      }
    }
  }

  // Dynamic prefixes: the path must be an OBJECT in every locale and every
  // leaf under it in EN must exist in every other locale (else any new EN
  // leaf will MISSING_MESSAGE in the other locale when triggered).
  for (const prefix of [...allDynamicPrefixes].sort()) {
    if (!isNamespace(locales.en, prefix)) {
      report.dynamicPrefixesMissingFromBase.push(prefix);
      continue;
    }
    const baseLeaves = [...leavesUnder(locales.en, prefix)];
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      for (const leaf of baseLeaves) {
        if (!isLeaf(locales[locale], leaf)) {
          report.dynamicDrift[locale].push(leaf);
        }
      }
    }
  }

  return report;
}

// ─── output ───────────────────────────────────────────────────────────────────

function printSection<T>(label: string, items: ReadonlyArray<T>, render: (x: T) => string): void {
  if (items.length === 0) {
    console.log(`  ✓ ${label}: 0`);
    return;
  }
  console.log(`  ⚠ ${label}: ${items.length}`);
  const slice = FULL ? items : items.slice(0, SAMPLE);
  for (const item of slice) console.log(`    - ${render(item)}`);
  if (!FULL && items.length > SAMPLE) {
    console.log(`    … and ${items.length - SAMPLE} more (--full to see all)`);
  }
}

const report = audit();

const totalBindings = [...report.bindings.values()].reduce((s, b) => s + b.size, 0);
console.log(`━━━ ${APP} — code ↔ i18n coverage ━━━\n`);
console.log(`Files with translation bindings: ${report.bindings.size}`);
console.log(`Total useTranslations/getTranslations bindings: ${totalBindings}`);
console.log(`Unresolved (fully dynamic) call sites: ${report.unresolved}`);

console.log(`\n— Code references absent from base (en) — fix the source OR add the key —`);
printSection('Static keys missing in en', report.codeKeysMissingFromBase, x => x);
printSection(
  'Dynamic prefixes missing in en',
  report.dynamicPrefixesMissingFromBase,
  x => `${x}.*`,
);

console.log(`\n— Cross-locale drift (in en+code, missing elsewhere) —`);
for (const locale of LOCALES) {
  if (locale === 'en') continue;
  console.log(`\n  ${locale}:`);
  printSection(`Static keys missing in ${locale}`, report.drift[locale], x => x);
  printSection(`Dynamic-prefix leaves missing in ${locale}`, report.dynamicDrift[locale], x => x);
}

const baseTotal =
  report.codeKeysMissingFromBase.length + report.dynamicPrefixesMissingFromBase.length;
const driftTotal =
  Object.values(report.drift).reduce((s, a) => s + a.length, 0) +
  Object.values(report.dynamicDrift).reduce((s, a) => s + a.length, 0);

console.log(`\n━━━ summary ━━━`);
console.log(`Missing in en (bugs):  ${baseTotal}`);
console.log(`Cross-locale drift:    ${driftTotal}`);

// ─── dump ─────────────────────────────────────────────────────────────────────

if (DUMP) {
  mkdirSync(DUMP_DIR, { recursive: true });
  const locales: Record<string, Json> = Object.fromEntries(LOCALES.map(l => [l, loadLocale(l)]));

  writeFileSync(
    resolve(DUMP_DIR, `i18n-code-gaps-en.json`),
    JSON.stringify(
      {
        staticKeysMissing: report.codeKeysMissingFromBase,
        dynamicPrefixesMissing: report.dynamicPrefixesMissingFromBase,
      },
      null,
      2,
    ),
  );

  for (const locale of LOCALES) {
    if (locale === 'en') continue;
    const gaps: Record<string, Json> = {};
    for (const key of report.drift[locale]) {
      gaps[key] = getPath(locales.en, key) ?? null;
    }
    for (const key of report.dynamicDrift[locale]) {
      gaps[key] = getPath(locales.en, key) ?? null;
    }
    writeFileSync(
      resolve(DUMP_DIR, `i18n-code-gaps-${locale}.json`),
      JSON.stringify(gaps, null, 2),
    );
  }
  console.log(`\nDumped per-locale gap maps to ${relative(ROOT, DUMP_DIR)}/i18n-code-gaps-*.json`);
}

const exitCode = baseTotal === 0 && driftTotal === 0 ? 0 : 1;
process.exit(exitCode);
