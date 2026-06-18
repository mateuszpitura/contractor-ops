#!/usr/bin/env tsx
/**
 * Reverse of `audit-i18n-code-coverage.ts`.
 *
 * That script catches keys referenced in code but missing from locale files
 * (runtime MISSING_MESSAGE bugs). This one catches the opposite: keys present
 * in locale files but never referenced by code (dead translations).
 *
 * v2 — added (after cluster-audit findings 2026-05-30):
 *   - Hook-namespace tracing: functions in `src/**` that bind
 *     `useTranslations('NS')` and return `t` (directly or via destructure)
 *     get registered. Consumers that import & call the hook then
 *     contribute `NS` to their candidate-namespace set, so a `t('leaf')`
 *     in the consumer resolves to `<NS>.<leaf>`.
 *   - Dynamic helper recognition: `tDyn(t, sub, leaf)`,
 *     `tDynLoose(t, sub, leaf)`, `tKey(t, key)` — composed as if the
 *     wrapper had called `t('${sub}.${leaf}')` / `t(key)`.
 *   - Constant-table key conventions: object literals with `labelKey`,
 *     `i18nKey`, `titleI18nKey`, `displayNameI18nKey`,
 *     `descriptionI18nKey`, `subjectI18nKey`, `bodyI18nKey`,
 *     `messageI18nKey`, `headerI18nKey`, `tooltipI18nKey`, `placeholderI18nKey`,
 *     `errorI18nKey`, `summaryI18nKey` whose value is a string literal
 *     get treated as floating literals (resolved against every namespace).
 *   - Floating-literal resolution widened: any leaf whose path ENDS in
 *     `.<floating>` (or equals `<NS>.<floating>` for any NS) is covered.
 *
 * Output unchanged:
 *   - Per-namespace dead-key counts.
 *   - `--dump` writes `.planning/translations/i18n-unused-{en,report}.json`.
 *   - `--full` prints every finding.
 *   - `--json` emits machine-readable summary on stdout.
 *
 * Exit code: always 0. Stale translations are a hygiene problem, not a
 * build gate.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const APP = 'apps/web-vite';
const SRC_DIR = resolve(ROOT, APP, 'src');
const MSG_DIR = resolve(ROOT, APP, 'messages');
/**
 * Additional roots scanned for i18n key references. Server / shared packages
 * emit `<NS>.<path>` literals via constant tables and seed files (e.g.
 * `packages/offboarding-templates/src/seeds.ts#displayNameI18nKey`).
 * If they aren't scanned, those keys look "dead" even though the runtime
 * threads them through the React client at render time.
 */
const EXTRA_SCAN_ROOTS = [
  resolve(ROOT, 'apps/api/src'),
  resolve(ROOT, 'apps/cron-worker/src'),
  resolve(ROOT, 'apps/public-api/src'),
  resolve(ROOT, 'packages/api/src'),
  resolve(ROOT, 'packages/offboarding-templates/src'),
  resolve(ROOT, 'packages/compliance-policy/src'),
  resolve(ROOT, 'packages/einvoice/src'),
  resolve(ROOT, 'packages/integrations/src'),
  resolve(ROOT, 'packages/feature-flags/src'),
  resolve(ROOT, 'packages/validators/src'),
];
const BASE_LOCALE = 'en';
const FULL = process.argv.includes('--full');
const DUMP = process.argv.includes('--dump');
const JSON_OUT = process.argv.includes('--json');
const DUMP_DIR = resolve(ROOT, '.planning/translations');
const SAMPLE = 20;

const SKIP_DIR_RE =
  /\/(node_modules|\.next|\.turbo|generated|__tests__|test|tests|__mocks__|mocks)\b|\.(test|spec)\.[jt]sx?$/;

// ─── locale ──────────────────────────────────────────────────────────────────

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function loadLocale(locale: string): Json {
  const path = resolve(MSG_DIR, `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf-8')) as Json;
}

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

function* leaves(node: Json, prefix: string): IterableIterator<string> {
  if (node === null) return;
  if (typeof node !== 'object' || Array.isArray(node)) {
    yield prefix;
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    const next = prefix === '' ? k : `${prefix}.${k}`;
    yield* leaves(v, next);
  }
}

// ─── source scanning ─────────────────────────────────────────────────────────

const USE_TRANSLATIONS_RE = /\b(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]/g;
const USE_TRANSLATIONS_ROOT_RE = /\b(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*\)/g;
const GET_TRANSLATIONS_NAMESPACE_RE =
  /\b(?:const|let)\s+(\w+)\s*=\s*await\s+getTranslations\(\s*(?:\{\s*[^}]*?namespace\s*:\s*['"]([^'"]+)['"][^}]*\}|['"]([^'"]+)['"])/g;

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

/** Object-literal keys whose string value is an i18n key fragment. */
const I18N_KEY_OBJECT_FIELDS = new Set([
  'labelKey',
  'i18nKey',
  'titleI18nKey',
  'displayNameI18nKey',
  'descriptionI18nKey',
  'subjectI18nKey',
  'bodyI18nKey',
  'messageI18nKey',
  'headerI18nKey',
  'tooltipI18nKey',
  'placeholderI18nKey',
  'errorI18nKey',
  'summaryI18nKey',
  'nameI18nKey',
  'ctaI18nKey',
]);

/** Helper functions that compose a final key from a bound translator. */
const T_HELPER_NAMES = new Set(['tDyn', 'tDynLoose', 'tKey', 'tHas']);

let topLevelNamespaces: Set<string> = new Set();

interface FileRefs {
  file: string;
  bindings: Map<string, string>;
  rootBindings: Set<string>;
  staticKeys: Set<string>;
  dynamicPrefixes: Set<string>;
  bareLiterals: Set<string>;
  wildcardNamespaces: Set<string>;
  floatingLiterals: Set<string>;
  /** Floating dynamic-prefix fragments (no trailing dot here). */
  floatingPrefixes: Set<string>;
  /** Namespaces this file imports through hook calls (cross-file binding). */
  candidateNamespaces: Set<string>;
  unresolved: number;
}

interface HookEntry {
  /** Namespace bound inside the hook's body. */
  ns: string;
  /** True if the hook also exposes a wildcard surface (calls `t(varExpr)`). */
  wildcard: boolean;
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

// ─── parsing primitives ──────────────────────────────────────────────────────

/** Read up to `max` comma-separated args starting after the opening paren. */
function readArgsList(text: string, start: number, max = 8): string[] {
  const out: string[] = [];
  let i = start;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (i >= text.length) return out;

  let argStart = i;
  let depth = 0;
  let stringQuote: '"' | "'" | '`' | null = null;
  let templateDepth = 0;

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
        const tail = text.slice(argStart, i).trim();
        if (tail) out.push(tail);
        return out;
      }
      depth--;
      i++;
      continue;
    }
    if (ch === ',' && depth === 0) {
      const tok = text.slice(argStart, i).trim();
      if (tok) out.push(tok);
      if (out.length >= max) return out;
      argStart = i + 1;
      i++;
      continue;
    }
    i++;
  }
  return out;
}

type ResolvedArg =
  | { kind: 'static'; value: string }
  | { kind: 'dynamicPrefix'; prefix: string }
  | { kind: 'unresolved' };

function resolveArg(arg: string): ResolvedArg {
  if (arg.length === 0) return { kind: 'unresolved' };
  const first = arg[0];
  if (first === '"' || first === "'") {
    if (arg.endsWith(first) && arg.length >= 2) {
      const value = arg.slice(1, -1);
      if (!value.includes('\\')) return { kind: 'static', value };
      return { kind: 'static', value: value.replace(/\\(['"\\])/g, '$1') };
    }
    return { kind: 'unresolved' };
  }
  if (first === '`') {
    if (!arg.endsWith('`')) return { kind: 'unresolved' };
    const inner = arg.slice(1, -1);
    const dollarIdx = inner.indexOf('${');
    if (dollarIdx < 0) return { kind: 'static', value: inner };
    const staticPrefix = inner.slice(0, dollarIdx);
    if (staticPrefix === '') return { kind: 'unresolved' };
    return { kind: 'dynamicPrefix', prefix: staticPrefix };
  }
  return { kind: 'unresolved' };
}

// ─── hook discovery (pass 1) ─────────────────────────────────────────────────

/**
 * Scan a file for functions that bind a translator and expose it (via
 * return / hook contract). Returns `Map<exportedFnName, { ns, wildcard }>`.
 *
 * Detection is intentionally generous: any function whose body contains
 * `useTranslations('NS')` AND a `return` that mentions `t` (or
 * `useTranslations` directly) counts. Consumers importing the function
 * inherit the binding.
 */
function extractHookNamespaces(text: string): Map<string, HookEntry> {
  const result = new Map<string, HookEntry>();

  // Pattern A: `export function NAME(`  /  `function NAME(`
  // Pattern B: `export const NAME = (` /` const NAME = (`
  // Pattern C: `export const NAME = function(`
  const declRe =
    /\b(?:export\s+(?:default\s+)?)?(?:function\s+(\w+)\s*[<(]|const\s+(\w+)\s*[:=][^=][^=]*(?:=>|function\b))/g;
  for (const m of text.matchAll(declRe)) {
    const name = m[1] ?? m[2];
    if (!name?.startsWith('use')) continue;
    // Find function body start (next `{` after the match).
    const fromIdx = (m.index ?? 0) + m[0].length;
    const braceIdx = text.indexOf('{', fromIdx);
    if (braceIdx < 0) continue;
    const body = readBalancedBlock(text, braceIdx);
    if (!body) continue;

    // Find a useTranslations('NS') call inside the body.
    let ns: string | null = null;
    USE_TRANSLATIONS_RE.lastIndex = 0;
    const innerMatch = body.match(/useTranslations\(\s*['"]([^'"]+)['"]/);
    if (innerMatch) ns = innerMatch[1];
    if (!ns) continue;

    // Body exposes the translator if it (a) returns the bound var, OR
    // (b) returns an object that includes `t`. Heuristic: look for `return`
    // followed by either the bound identifier or a `{ t` token.
    if (!(/\breturn\b[^;]*\bt\b/.test(body) || /\breturn\b[^;]*\{[^}]*\bt\b/.test(body))) continue;

    // Wildcard if the hook itself dispatches `t(varExpr)`.
    const wildcard = /\bt\(\s*[A-Za-z_$][\w$]*\s*[,)]/.test(body);
    result.set(name, { ns, wildcard });
  }
  return result;
}

function readBalancedBlock(text: string, openBraceIdx: number): string | null {
  let i = openBraceIdx + 1;
  let depth = 1;
  let stringQuote: '"' | "'" | '`' | null = null;
  let templateDepth = 0;
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
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(openBraceIdx + 1, i);
      i++;
      continue;
    }
    i++;
  }
  return null;
}

/** Identify named imports referenced anywhere in the file. */
function extractImportedNames(text: string): Set<string> {
  const out = new Set<string>();
  const importRe = /\bimport\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"][^'"]+['"]/g;
  for (const m of text.matchAll(importRe)) {
    for (const raw of m[1].split(',')) {
      const cleaned = raw
        .trim()
        .replace(/^type\s+/, '')
        .replace(/\s+as\s+\w+$/i, '');
      if (cleaned) out.add(cleaned);
    }
  }
  // Also default imports / namespace imports may matter for hook re-exports.
  return out;
}

// ─── per-file ref extraction (pass 2) ────────────────────────────────────────

function parseFile(file: string, hookMap: Map<string, HookEntry>): FileRefs {
  const text = readFileSync(file, 'utf-8');
  const bindings = new Map<string, string>();
  const rootBindings = new Set<string>();
  const staticKeys = new Set<string>();
  const dynamicPrefixes = new Set<string>();
  const bareLiterals = new Set<string>();
  const wildcardNamespaces = new Set<string>();
  const floatingLiterals = new Set<string>();
  const floatingPrefixes = new Set<string>();
  const candidateNamespaces = new Set<string>();
  let unresolved = 0;

  for (const m of text.matchAll(USE_TRANSLATIONS_RE)) {
    bindings.set(m[1], m[2]);
    candidateNamespaces.add(m[2]);
  }
  for (const m of text.matchAll(USE_TRANSLATIONS_ROOT_RE)) {
    rootBindings.add(m[1]);
  }
  for (const m of text.matchAll(GET_TRANSLATIONS_NAMESPACE_RE)) {
    const varName = m[1];
    const ns = m[2] ?? m[3];
    if (ns) {
      bindings.set(varName, ns);
      candidateNamespaces.add(ns);
    }
  }

  // Cross-file hook tracing: any imported symbol that resolves to a hook
  // contributes its namespace to this file's candidate set, and (if the
  // hook is a wildcard surface) marks the namespace wildcard-covered.
  const imported = extractImportedNames(text);
  for (const name of imported) {
    const hook = hookMap.get(name);
    if (!hook) continue;
    candidateNamespaces.add(hook.ns);
    if (hook.wildcard) wildcardNamespaces.add(hook.ns);
  }
  // Also: hooks defined IN this file contribute their NS even without import.
  const localHooks = extractHookNamespaces(text);
  for (const [, hook] of localHooks) {
    candidateNamespaces.add(hook.ns);
    if (hook.wildcard) wildcardNamespaces.add(hook.ns);
  }

  // Direct t-name calls.
  const candidateNames = new Set<string>([
    ...bindings.keys(),
    ...rootBindings,
    ...TRANSLATION_VAR_HINTS,
  ]);
  for (const name of candidateNames) {
    const callRe = new RegExp(`\\b${name}\\(`, 'g');
    for (const m of text.matchAll(callRe)) {
      const start = m.index! + m[0].length;
      const args = readArgsList(text, start, 3);
      if (args.length === 0) continue;
      const ns = bindings.get(name);
      const isRoot = rootBindings.has(name);
      const resolved = resolveArg(args[0]);
      if (resolved.kind === 'static') {
        if (ns) staticKeys.add(`${ns}.${resolved.value}`);
        else if (isRoot) staticKeys.add(resolved.value);
        else floatingLiterals.add(resolved.value);
      } else if (resolved.kind === 'dynamicPrefix') {
        const prefix = resolved.prefix.replace(/\.$/, '');
        if (ns) {
          if (prefix) dynamicPrefixes.add(`${ns}.${prefix}`);
          else dynamicPrefixes.add(ns);
        } else if (isRoot) {
          if (prefix) dynamicPrefixes.add(prefix);
        } else if (prefix) {
          floatingPrefixes.add(prefix);
        }
      } else {
        if (ns) {
          wildcardNamespaces.add(ns);
          unresolved++;
        } else if (isRoot) {
          unresolved++;
        }
      }
    }
  }

  // T-helper calls: tDyn(t, sub, leaf) / tDynLoose(t, sub, leaf) / tKey(t, key)
  for (const helper of T_HELPER_NAMES) {
    const callRe = new RegExp(`\\b${helper}\\(`, 'g');
    for (const m of text.matchAll(callRe)) {
      const start = m.index! + m[0].length;
      const args = readArgsList(text, start, 4);
      if (args.length < 2) continue;
      const tName = args[0].match(/^[A-Za-z_$][\w$]*$/) ? args[0] : null;
      const tNs = tName ? bindings.get(tName) : undefined;
      if (helper === 'tKey' || helper === 'tHas') {
        // tKey(t, KEY) — like t(KEY)
        const keyArg = args[1];
        const resolved = resolveArg(keyArg);
        if (resolved.kind === 'static') {
          if (tNs) staticKeys.add(`${tNs}.${resolved.value}`);
          else floatingLiterals.add(resolved.value);
        } else if (resolved.kind === 'dynamicPrefix') {
          const prefix = resolved.prefix.replace(/\.$/, '');
          if (prefix) {
            if (tNs) dynamicPrefixes.add(`${tNs}.${prefix}`);
            else floatingPrefixes.add(prefix);
          }
        } else if (tNs) {
          wildcardNamespaces.add(tNs);
        }
      } else if (helper === 'tDyn' || helper === 'tDynLoose') {
        // tDyn(t, sub, leaf, values?) — composes `${sub}.${leaf}`
        const subArg = args[1];
        const leafArg = args.length >= 3 ? args[2] : null;
        const subRes = resolveArg(subArg);
        const leafRes = leafArg ? resolveArg(leafArg) : { kind: 'unresolved' as const };
        if (subRes.kind === 'static') {
          const subPath = subRes.value.replace(/\.$/, '');
          if (leafRes.kind === 'static') {
            const full = subPath ? `${subPath}.${leafRes.value}` : leafRes.value;
            if (tNs) staticKeys.add(`${tNs}.${full}`);
            else floatingLiterals.add(full);
          } else {
            // Leaf is dynamic → cover sub-prefix wildcard
            if (tNs) {
              if (subPath) dynamicPrefixes.add(`${tNs}.${subPath}`);
              else wildcardNamespaces.add(tNs);
            } else if (subPath) {
              floatingPrefixes.add(subPath);
            }
          }
        } else if (subRes.kind === 'dynamicPrefix') {
          // sub-prefix has an interpolation → wildcard the bound NS
          if (tNs) wildcardNamespaces.add(tNs);
        } else {
          if (tNs) wildcardNamespaces.add(tNs);
        }
      }
    }
  }

  // Bare string literals shaped like 'NS.path.leaf' (or any qualifying form).
  const stringLitRe = /(['"])((?:[A-Za-z][A-Za-z0-9_$]*)(?:\.[A-Za-z][A-Za-z0-9_$]*){1,})\1/g;
  for (const m of text.matchAll(stringLitRe)) {
    const value = m[2];
    const ns = value.split('.', 1)[0];
    if (topLevelNamespaces.has(ns)) bareLiterals.add(value);
    else floatingLiterals.add(value);
  }

  // Object-literal i18n-key fields: `labelKey: 'foo.bar'`, `titleI18nKey: 'x'`.
  for (const field of I18N_KEY_OBJECT_FIELDS) {
    const fieldRe = new RegExp(`\\b${field}\\s*:\\s*(['"])([^'"\\\\]+)\\1`, 'g');
    for (const m of text.matchAll(fieldRe)) {
      const value = m[2];
      const ns = value.split('.', 1)[0];
      if (topLevelNamespaces.has(ns)) bareLiterals.add(value);
      else floatingLiterals.add(value);
    }
    // Same field with template literal containing no interpolation.
    const fieldTplRe = new RegExp(`\\b${field}\\s*:\\s*\`([^\\\\\`$]+)\``, 'g');
    for (const m of text.matchAll(fieldTplRe)) {
      const value = m[1];
      const ns = value.split('.', 1)[0];
      if (topLevelNamespaces.has(ns)) bareLiterals.add(value);
      else floatingLiterals.add(value);
    }
    // Dynamic template: capture static prefix as a floating prefix.
    const fieldDynRe = new RegExp(`\\b${field}\\s*:\\s*\`([^\\\\\`$]*)\\$`, 'g');
    for (const m of text.matchAll(fieldDynRe)) {
      const prefix = (m[1] ?? '').replace(/\.$/, '');
      if (prefix) floatingPrefixes.add(prefix);
    }
  }

  return {
    file,
    bindings,
    rootBindings,
    staticKeys,
    dynamicPrefixes,
    bareLiterals,
    wildcardNamespaces,
    floatingLiterals,
    floatingPrefixes,
    candidateNamespaces,
    unresolved,
  };
}

// ─── classify ────────────────────────────────────────────────────────────────

interface AuditReport {
  totalLeaves: number;
  usedStatic: number;
  usedBareLiteral: number;
  coveredDynamic: number;
  coveredWildcard: number;
  coveredFloating: number;
  unused: string[];
  wildcardNamespaces: string[];
  unresolvedCallSites: number;
  hookCount: number;
  perNamespace: { ns: string; total: number; unused: number; unusedKeys: string[] }[];
}

function audit(): AuditReport {
  const enRoot = loadLocale(BASE_LOCALE);
  if (enRoot === null || typeof enRoot !== 'object' || Array.isArray(enRoot)) {
    throw new Error('en.json must be a JSON object at the root');
  }
  topLevelNamespaces = new Set(Object.keys(enRoot));
  const allLeaves = [...leaves(enRoot, '')];

  const files = listSourceFiles(SRC_DIR);
  for (const root of EXTRA_SCAN_ROOTS) {
    try {
      statSync(root);
    } catch {
      continue;
    }
    listSourceFiles(root, files);
  }

  // Pass 1 — discover hooks across the whole source tree.
  const hookMap = new Map<string, HookEntry>();
  for (const f of files) {
    const text = readFileSync(f, 'utf-8');
    for (const [name, entry] of extractHookNamespaces(text)) {
      // First definition wins; collisions are vanishingly rare in this tree.
      if (!hookMap.has(name)) hookMap.set(name, entry);
    }
  }

  // Pass 2 — extract refs with hookMap in hand.
  const staticKeys = new Set<string>();
  const dynamicPrefixes = new Set<string>();
  const bareLiterals = new Set<string>();
  const wildcardNamespaces = new Set<string>();
  const floatingLiterals = new Set<string>();
  const floatingPrefixes = new Set<string>();
  let unresolved = 0;
  for (const f of files) {
    const refs = parseFile(f, hookMap);
    for (const k of refs.staticKeys) staticKeys.add(k);
    for (const p of refs.dynamicPrefixes) dynamicPrefixes.add(p);
    for (const lit of refs.bareLiterals) bareLiterals.add(lit);
    for (const w of refs.wildcardNamespaces) wildcardNamespaces.add(w);
    for (const fl of refs.floatingLiterals) floatingLiterals.add(fl);
    for (const fp of refs.floatingPrefixes) floatingPrefixes.add(fp);
    unresolved += refs.unresolved;
  }

  const dynamicList = [...dynamicPrefixes];
  function isDynCovered(key: string): boolean {
    for (const p of dynamicList) {
      if (key === p) return true;
      if (key.startsWith(`${p}.`)) return true;
    }
    return false;
  }
  const wildcardList = [...wildcardNamespaces];
  function isWildcardCovered(key: string): boolean {
    for (const ns of wildcardList) {
      if (key === ns) return true;
      if (key.startsWith(`${ns}.`)) return true;
    }
    return false;
  }
  const floatingStaticArr = [...floatingLiterals];
  const floatingPrefixArr = [...floatingPrefixes];
  // Index by trailing segment count for slight speedup.
  function isFloatingCovered(key: string): boolean {
    // Exact / suffix match: the key's path ends in ".<floating>" or equals it.
    for (const f of floatingStaticArr) {
      if (key === f) return true;
      if (key.endsWith(`.${f}`)) return true;
    }
    // Prefix coverage: any path segment in `key` starts at a floating prefix.
    for (const p of floatingPrefixArr) {
      if (key === p) return true;
      // Match when "<X>.<p>.<...>" or "<p>.<...>" (prefix is somewhere mid-path).
      if (key.startsWith(`${p}.`)) return true;
      if (key.includes(`.${p}.`)) return true;
      if (key.endsWith(`.${p}`)) return true;
    }
    return false;
  }

  const unused: string[] = [];
  let usedStatic = 0;
  let usedBareLiteral = 0;
  let coveredDynamic = 0;
  let coveredWildcard = 0;
  let coveredFloating = 0;

  for (const leaf of allLeaves) {
    if (staticKeys.has(leaf)) {
      usedStatic++;
      continue;
    }
    if (bareLiterals.has(leaf)) {
      usedBareLiteral++;
      continue;
    }
    if (isDynCovered(leaf)) {
      coveredDynamic++;
      continue;
    }
    if (isWildcardCovered(leaf)) {
      coveredWildcard++;
      continue;
    }
    if (isFloatingCovered(leaf)) {
      coveredFloating++;
      continue;
    }
    unused.push(leaf);
  }
  unused.sort();

  const perNs: Map<string, { total: number; unused: string[] }> = new Map();
  for (const leaf of allLeaves) {
    const ns = leaf.split('.', 1)[0];
    const entry = perNs.get(ns) ?? { total: 0, unused: [] };
    entry.total++;
    perNs.set(ns, entry);
  }
  for (const u of unused) {
    const ns = u.split('.', 1)[0];
    const entry = perNs.get(ns);
    if (entry) entry.unused.push(u);
  }
  const perNamespace = [...perNs.entries()]
    .map(([ns, v]) => ({ ns, total: v.total, unused: v.unused.length, unusedKeys: v.unused }))
    .sort((a, b) => b.unused - a.unused);

  return {
    totalLeaves: allLeaves.length,
    usedStatic,
    usedBareLiteral,
    coveredDynamic,
    coveredWildcard,
    coveredFloating,
    unused,
    wildcardNamespaces: [...wildcardNamespaces].sort(),
    unresolvedCallSites: unresolved,
    hookCount: hookMap.size,
    perNamespace,
  };
}

// ─── output ──────────────────────────────────────────────────────────────────

const report = audit();

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        totalLeaves: report.totalLeaves,
        usedStatic: report.usedStatic,
        usedBareLiteral: report.usedBareLiteral,
        coveredDynamic: report.coveredDynamic,
        coveredWildcard: report.coveredWildcard,
        coveredFloating: report.coveredFloating,
        unused: report.unused.length,
        wildcardNamespaces: report.wildcardNamespaces,
        hookCount: report.hookCount,
        unresolvedCallSites: report.unresolvedCallSites,
        perNamespace: report.perNamespace.map(({ ns, total, unused }) => ({ ns, total, unused })),
        unusedKeys: report.unused,
      },
      null,
      2,
    ),
  );
} else {
  const pct = (n: number) => ((n / report.totalLeaves) * 100).toFixed(1);
  console.log(`━━━ ${APP} — i18n dead-key audit (v2) ━━━\n`);
  console.log(`Total leaves in ${BASE_LOCALE}.json: ${report.totalLeaves}`);
  console.log(`Hooks traced (use* fns exposing a bound translator): ${report.hookCount}`);
  console.log(
    `  ✓ used via static t('leaf'):           ${report.usedStatic} (${pct(report.usedStatic)}%)`,
  );
  console.log(
    `  ✓ used via bare 'NS.leaf' literal:     ${report.usedBareLiteral} (${pct(report.usedBareLiteral)}%)`,
  );
  console.log(
    `  ⊕ covered by dynamic prefix t(\`p.\${x}\`): ${report.coveredDynamic} (${pct(report.coveredDynamic)}%)`,
  );
  console.log(
    `  ✷ covered by wildcard ns (unresolved t(x)): ${report.coveredWildcard} (${pct(report.coveredWildcard)}%)`,
  );
  console.log(
    `  ⊕ covered by floating literal (xfile binding): ${report.coveredFloating} (${pct(report.coveredFloating)}%)`,
  );
  console.log(
    `  ✗ unused (no code reference):          ${report.unused.length} (${pct(report.unused.length)}%)`,
  );
  console.log(
    `Wildcard namespaces (unresolved t(x) hit): ${report.wildcardNamespaces.join(', ') || '(none)'}`,
  );
  console.log(`Unresolved (fully dynamic) call sites scanned: ${report.unresolvedCallSites}`);

  console.log(`\n— Per-namespace dead keys (top by absolute count) —`);
  const nsSlice = FULL ? report.perNamespace : report.perNamespace.slice(0, 25);
  for (const ns of nsSlice) {
    if (ns.unused === 0) continue;
    const pctNs = ((ns.unused / ns.total) * 100).toFixed(0);
    console.log(
      `  ${ns.ns.padEnd(36)} ${String(ns.unused).padStart(5)} / ${String(ns.total).padStart(5)}  (${pctNs}% dead)`,
    );
  }

  console.log(`\n— Sample unused keys (alphabetical) —`);
  const slice = FULL ? report.unused : report.unused.slice(0, SAMPLE);
  for (const k of slice) console.log(`  - ${k}`);
  if (!FULL && report.unused.length > SAMPLE) {
    console.log(`  … and ${report.unused.length - SAMPLE} more (--full or --dump for all)`);
  }
}

if (DUMP) {
  mkdirSync(DUMP_DIR, { recursive: true });
  const enRoot = loadLocale(BASE_LOCALE);
  const map: Record<string, Json> = {};
  for (const k of report.unused) {
    map[k] = getPath(enRoot, k) ?? null;
  }
  writeFileSync(resolve(DUMP_DIR, `i18n-unused-en.json`), JSON.stringify(map, null, 2));
  writeFileSync(
    resolve(DUMP_DIR, `i18n-unused-report.json`),
    JSON.stringify(
      {
        totalLeaves: report.totalLeaves,
        usedStatic: report.usedStatic,
        usedBareLiteral: report.usedBareLiteral,
        coveredDynamic: report.coveredDynamic,
        coveredWildcard: report.coveredWildcard,
        coveredFloating: report.coveredFloating,
        unused: report.unused.length,
        wildcardNamespaces: report.wildcardNamespaces,
        hookCount: report.hookCount,
        unresolvedCallSites: report.unresolvedCallSites,
        perNamespace: report.perNamespace,
      },
      null,
      2,
    ),
  );
  console.log(
    `\nDumped ${report.unused.length} unused keys to ${relative(ROOT, DUMP_DIR)}/i18n-unused-en.json`,
  );
}

process.exit(0);
