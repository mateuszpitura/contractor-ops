#!/usr/bin/env tsx
/**
 * Source-code-vs-i18n auditor — the missing third leg.
 *
 * audit-translations.ts        compares locale files against each other (key
 *                              presence: do pl/de/ar have every en key?)
 * audit-translations-quality.ts checks value quality (placeholders, leakage,
 *                              empties)
 *
 * THIS script closes the loop: it parses every .ts/.tsx file under apps/web-vite/src
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
 *   pnpm tsx scripts/audit-i18n-code-coverage.ts --allow-hardcoded
 *
 * Flags:
 *   --full              print every finding (vs the default top-N sample per category)
 *   --dump              write `.planning/translations/i18n-code-gaps-<locale>.json` per
 *                       locale, shaped `{ path: { sample: en-value-if-available } }`,
 *                       so a follow-up translation pass can read it directly.
 *   --allow-hardcoded   do not exit non-zero when the JSX hardcoded-string
 *                       detector flags strings. Use during migration; remove
 *                       once a file is fully translated.
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
const ALLOW_HARDCODED = process.argv.includes('--allow-hardcoded');
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

// ─── hardcoded-string detector ───────────────────────────────────────────────
//
// Independent pass over .tsx files: flags raw string literals that look like
// user-facing UI copy but were never wrapped in t('...'). Heuristic-based, not
// type-aware — designed to catch the bulk of regressions without false-flagging
// className tokens, test IDs, or technical literals.

interface HardcodedFinding {
  file: string;
  line: number;
  column: number;
  snippet: string;
  context: 'jsx-text' | 'jsx-attr' | 'toast';
}

const HARDCODED_SKIP_DIR_RE =
  /\/(node_modules|\.next|\.turbo|generated|__tests__|test|tests|__mocks__|mocks)\b|(?:test-utils\.tsx?|\.(test|spec)\.tsx?)$/;

const FLAGGABLE_JSX_ATTRS = new Set([
  'placeholder',
  'aria-label',
  'title',
  'description',
  'label',
  'alt',
]);

const TOAST_METHODS = new Set(['success', 'error', 'info', 'warning']);

const HARDCODED_IGNORE_COMMENT_RE = /(?:\/\*\s*i18n-ignore\s*\*\/|\/\/\s*i18n-ignore)/;

const BRAND_ALLOWLIST = new Set([
  'Slack',
  'Jira',
  'Google Workspace',
  'Microsoft Teams',
  'ZATCA',
  'KSeF',
  'Peppol',
  'InPost',
  'DPD',
  'UPS',
  'Stripe',
  'Sentry',
  'GitHub',
  'Linear',
  'tRPC',
  'GDPR',
]);

const SEPARATOR_CHARS = new Set(['·', '—', '–', '•', ':', '/', '|', '-', '.']);
const ALPHA_RE = /[\p{L}]/u; // any unicode letter (Latin, Polish, German, Arabic, …)
const PURE_INTERPOLATION_RE = /^\s*\{[^{}]+\}\s*$/;
const SIZE_UNIT_RE = /^[\d.,]+\s*(?:px|rem|em|ms|s|%|vh|vw|deg|fr)$/;
const NUMERIC_ONLY_RE = /^[\d\s.,+\-:/]+$/;
const URL_RE = /^https?:\/\//i;
// Emoji-only literal: whitespace + emoji presentation/pictographic +
// zero-width-joiner (U+200D) + variation-selector-16 (U+FE0F) used to compose
// multi-codepoint emoji (e.g. family / flag sequences).
const EMOJI_ONLY_RE = /^(?:\s|\p{Emoji_Presentation}|\p{Extended_Pictographic}|‍|️)+$/u;

function listTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    if (HARDCODED_SKIP_DIR_RE.test(`/${rel}`)) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      listTsxFiles(full, out);
    } else if (/\.tsx$/.test(full) && !HARDCODED_SKIP_DIR_RE.test(full)) {
      out.push(full);
    }
  }
  return out;
}

/** True when the literal looks like a candidate for translation. */
function shouldFlagLiteral(value: string, opts: { strictJsxText?: boolean } = {}): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3) return false;
  if (BRAND_ALLOWLIST.has(trimmed)) return false;
  if (NUMERIC_ONLY_RE.test(trimmed)) return false;
  if (SIZE_UNIT_RE.test(trimmed)) return false;
  if (URL_RE.test(trimmed)) return false;
  if (PURE_INTERPOLATION_RE.test(trimmed)) return false;
  if (EMOJI_ONLY_RE.test(trimmed)) return false;
  // Pure separator/punctuation strings (e.g. " · ", " — ").
  let isPureSeparator = true;
  for (const ch of trimmed) {
    if (!(SEPARATOR_CHARS.has(ch) || /\s/.test(ch))) {
      isPureSeparator = false;
      break;
    }
  }
  if (isPureSeparator) return false;
  // Require at least one alpha letter — kills tokens like "v1.2.3" or "0.25".
  if (!ALPHA_RE.test(trimmed)) return false;

  // For JSX text we apply a stricter shape filter to avoid catching TS type
  // annotations (`Promise<X>`), comparisons (`>= 1`), and other code that
  // happens to live between `>` and `<` syntactically. UI copy almost
  // never contains these characters.
  if (opts.strictJsxText) {
    if (/[=();{}[\]|&]|=>|::|\+\+|--/.test(trimmed)) return false;
    // Looks like a generic / call expression remnant: `,` followed by code-like
    // tokens, or a stray colon outside of label:value pairs.
    if (/[,;]\s*$/.test(trimmed)) return false;
    // Require either a space (multi-word prose) or a fairly long alpha run.
    if (!/\s/.test(trimmed) && trimmed.length < 5) return false;
    // Require the literal to start with a letter or quote — kills `): Foo`
    // and `): Record` fragments.
    if (!/^[\p{L}"'`]/u.test(trimmed)) return false;
  }
  return true;
}

/** Locate the start of the line containing `index`. */
function lineStart(text: string, index: number): number {
  let i = index;
  while (i > 0 && text[i - 1] !== '\n') i--;
  return i;
}

function previousNonBlankLineRange(
  text: string,
  lineStartIdx: number,
): { start: number; end: number } | null {
  if (lineStartIdx <= 0) return null;
  let end = lineStartIdx - 1; // points at the trailing '\n' of the previous line
  while (end > 0 && text[end] === '\n') end--;
  if (end <= 0) return null;
  let start = end;
  while (start > 0 && text[start - 1] !== '\n') start--;
  return { start, end: end + 1 };
}

/** True when the i18n-ignore comment sits on the immediately-preceding line. */
function hasIgnoreComment(text: string, literalStart: number): boolean {
  const lsIdx = lineStart(text, literalStart);
  // Same-line trailing comment after the literal: scan to end-of-line.
  let eol = literalStart;
  while (eol < text.length && text[eol] !== '\n') eol++;
  const sameLine = text.slice(lsIdx, eol);
  if (HARDCODED_IGNORE_COMMENT_RE.test(sameLine)) return true;
  // Previous non-blank line.
  const prev = previousNonBlankLineRange(text, lsIdx);
  if (!prev) return false;
  const prevLine = text.slice(prev.start, prev.end);
  return HARDCODED_IGNORE_COMMENT_RE.test(prevLine);
}

function lineColumnOf(text: string, index: number): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: index - lastNewline };
}

/**
 * Read a string-literal arg starting at `start` if it is a plain string (not
 * template / not identifier). Returns its inner unescaped value and the index
 * past its closing quote, or null.
 */
function readStringLiteral(text: string, start: number): { value: string; end: number } | null {
  if (start >= text.length) return null;
  const q = text[start];
  if (q !== "'" && q !== '"') return null;
  let i = start + 1;
  let out = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      const n = text[i + 1];
      if (n === q) {
        out += q;
        i += 2;
        continue;
      }
      if (n === 'n') {
        out += '\n';
        i += 2;
        continue;
      }
      if (n === 't') {
        out += '\t';
        i += 2;
        continue;
      }
      if (n === '\\') {
        out += '\\';
        i += 2;
        continue;
      }
      // Unknown escape: keep raw.
      out += n ?? '';
      i += 2;
      continue;
    }
    if (ch === q) return { value: out, end: i + 1 };
    if (ch === '\n') return null; // unterminated for our purposes
    out += ch;
    i++;
  }
  return null;
}

function auditHardcodedStrings(): HardcodedFinding[] {
  const findings: HardcodedFinding[] = [];
  const files = listTsxFiles(SRC_DIR);

  for (const file of files) {
    const text = readFileSync(file, 'utf-8');

    // ── Pass 1: JSX text children ──
    // Match `>TEXT<` segments. We then strip JSX expression containers and
    // sub-tag noise, and require the remaining literal text to look human.
    // Simple regex: `>([^<>{}]+)<` — skips text that contains tags or
    // interpolations; conservative but kills false positives.
    const jsxTextRe = />([^<>{}]+)</g;
    for (const m of text.matchAll(jsxTextRe)) {
      const raw = m[1];
      const trimmed = raw.trim();
      if (!shouldFlagLiteral(trimmed, { strictJsxText: true })) continue;
      const openIdx = m.index ?? 0; // position of '>'
      const literalStart = openIdx + 1; // first content char
      const closeIdx = openIdx + 1 + raw.length; // position of '<'

      // Filter: skip TS/JS code that looks like text between angle brackets.
      // - `=>` arrow followed by code (preceding char is '=')
      // - `<Identifier<X>` generics (preceding char is alpha/digit/'_' AND
      //   the '<' that follows is itself part of a generic, not a JSX tag).
      const prevCh = openIdx > 0 ? text[openIdx - 1] : '';
      if (prevCh === '=') continue;
      // For the closing '<': real JSX text is followed by '<' then '/' (close
      // tag) OR a letter that starts a Component tag. Generics' '<' is often
      // followed by an uppercase letter too, so distinguish by whether the
      // preceding token (before the opening '>') looked like a JSX close.
      // Heuristic: real JSX text is preceded by '>' that closes a tag whose
      // last char before '>' is one of `"`, `}`, `/`, or a letter that's part
      // of a component name (PascalCase) or HTML tag (lowercase).
      // Code-side '>' is most commonly after a generic identifier — we already
      // filter by code-shape via strictJsxText. As a final guard, skip when
      // the character before the closing '<' is alphanumeric/underscore AND
      // the literal contains no whitespace and starts with an uppercase letter
      // — that's the `Promise` shape.
      const beforeClose = closeIdx > 0 ? text[closeIdx - 1] : '';
      if (!/\s/.test(trimmed) && /^[A-Z]/.test(trimmed) && /[A-Za-z0-9_)\]]/.test(beforeClose)) {
        continue;
      }
      if (hasIgnoreComment(text, literalStart)) continue;
      const { line, column } = lineColumnOf(text, literalStart);
      findings.push({
        file,
        line,
        column,
        snippet: trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed,
        context: 'jsx-text',
      });
    }

    // ── Pass 2: JSX attrs (placeholder, aria-label, title, description, label, alt) ──
    for (const attr of FLAGGABLE_JSX_ATTRS) {
      const re = new RegExp(`(^|[\\s{(/])${attr.replace('-', '\\-')}\\s*=\\s*(['"])`, 'gm');
      for (const m of text.matchAll(re)) {
        // m[0] includes the leading boundary char; quoteStart is the actual quote.
        const quoteStart = (m.index ?? 0) + m[0].length - 1;
        // Skip property-access patterns: `.description =` or `:description =`.
        const before = (m.index ?? 0) > 0 ? text[(m.index ?? 0) - 1] : '';
        if (before === '.' || before === ':') continue;
        // Skip TS member: `foo: { description: '…' }` — but the regex requires
        // `=` so this won't match. We're safe.
        const lit = readStringLiteral(text, quoteStart);
        if (!lit) continue;
        if (!shouldFlagLiteral(lit.value)) continue;
        if (hasIgnoreComment(text, quoteStart)) continue;
        const { line, column } = lineColumnOf(text, quoteStart);
        findings.push({
          file,
          line,
          column,
          snippet: `${attr}="${lit.value.length > 60 ? `${lit.value.slice(0, 57)}…` : lit.value}"`,
          context: 'jsx-attr',
        });
      }
    }

    // ── Pass 3: toast.{success,error,info,warning}('...') ──
    const toastRe = /\btoast\.(\w+)\s*\(\s*(['"])/g;
    for (const m of text.matchAll(toastRe)) {
      const method = m[1];
      if (!TOAST_METHODS.has(method)) continue;
      const quoteStart = (m.index ?? 0) + m[0].length - 1;
      const lit = readStringLiteral(text, quoteStart);
      if (!lit) continue;
      if (!shouldFlagLiteral(lit.value)) continue;
      if (hasIgnoreComment(text, quoteStart)) continue;
      const { line, column } = lineColumnOf(text, quoteStart);
      findings.push({
        file,
        line,
        column,
        snippet: `toast.${method}("${lit.value.length > 60 ? `${lit.value.slice(0, 57)}…` : lit.value}")`,
        context: 'toast',
      });
    }
  }

  // Sort: file, then line.
  findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
  return findings;
}

// ─── output ───────────────────────────────────────────────────────────────────

function printSection<T>(label: string, items: readonly T[], render: (x: T) => string): void {
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

const hardcoded = auditHardcodedStrings();
console.log(`\n— Hardcoded UI strings (not wrapped in t()) —`);
if (hardcoded.length === 0) {
  console.log(`  ✓ No hardcoded user-facing strings detected.`);
} else {
  console.log(`  ❌ Hardcoded UI strings (not wrapped in t()): ${hardcoded.length}`);
  const slice = FULL ? hardcoded : hardcoded.slice(0, SAMPLE);
  for (const f of slice) {
    const rel = relative(ROOT, f.file);
    console.log(`    - ${rel}:${f.line}:${f.column}  [${f.context}]  ${f.snippet}`);
  }
  if (!FULL && hardcoded.length > SAMPLE) {
    console.log(`    … and ${hardcoded.length - SAMPLE} more (--full to see all)`);
  }
  if (ALLOW_HARDCODED) {
    console.log(`    (--allow-hardcoded set: not failing the build on hardcoded strings)`);
  }
}

console.log(`\n━━━ summary ━━━`);
console.log(`Missing in en (bugs):  ${baseTotal}`);
console.log(`Cross-locale drift:    ${driftTotal}`);
console.log(`Hardcoded UI strings:  ${hardcoded.length}${ALLOW_HARDCODED ? ' (allowed)' : ''}`);

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

const hardcodedFails = !ALLOW_HARDCODED && hardcoded.length > 0;
const exitCode = baseTotal === 0 && driftTotal === 0 && !hardcodedFails ? 0 : 1;
process.exit(exitCode);
