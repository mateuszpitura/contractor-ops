#!/usr/bin/env tsx
/**
 * Second-pass migration — convert dynamic-key sites that DON'T carry the
 * `as Parameters<typeof t>` cast (the augmentation now makes them fail
 * tsc on their own). Pattern: `t(\`prefix.${expr}\`)` → `tDyn(t, 'prefix', expr)`.
 *
 * Conservative — only touches single-interpolation template literals
 * whose dynamic segment is the trailing piece (no suffix after `${…}`).
 * Mid-template dynamic (`t(\`a.${x}.b\`)`) is reported for manual review.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'tinyglobby';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const SRC_GLOBS = ['apps/web/src/**/*.ts', 'apps/web/src/**/*.tsx'];
const TDYN_IMPORT = "import { tDyn } from '@/i18n/typed-keys';";

function ensureTDynImport(src: string): string {
  if (src.includes("from '@/i18n/typed-keys'")) return src;
  const len = src.length;
  let i = 0;
  let lastImportEnd = -1;
  while (i < len) {
    while (i < len && /\s/.test(src[i]!)) i++;
    if (src[i] === "'" || src[i] === '"') {
      const quote = src[i];
      let j = i + 1;
      while (j < len && src[j] !== quote) j++;
      let k = j + 1;
      while (k < len && /[\s;]/.test(src[k]!) && src[k] !== '\n') k++;
      i = k;
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') i++;
      continue;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (src.startsWith('import', i) && /\s|\{|\*|'/.test(src[i + 6] ?? '')) {
      let j = i + 6;
      let inString: string | null = null;
      let depth = 0;
      while (j < len) {
        const ch = src[j]!;
        if (inString) {
          if (ch === '\\') {
            j += 2;
            continue;
          }
          if (ch === inString) inString = null;
        } else if (ch === "'" || ch === '"' || ch === '`') {
          inString = ch;
        } else if (ch === '{' || ch === '(') depth++;
        else if (ch === '}' || ch === ')') depth--;
        else if (ch === ';' && depth === 0) {
          lastImportEnd = j;
          j++;
          break;
        }
        j++;
      }
      i = j;
      continue;
    }
    break;
  }
  if (lastImportEnd === -1) return `${TDYN_IMPORT}\n${src}`;
  return `${src.slice(0, lastImportEnd + 1)}\n${TDYN_IMPORT}${src.slice(lastImportEnd + 1)}`;
}

function findClosingBacktick(src: string, openIdx: number): number {
  let i = openIdx + 1;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '`') return i;
    if (ch === '$' && src[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < src.length && depth > 0) {
        const c = src[j]!;
        if (c === '{') depth++;
        else if (c === '}') depth--;
        if (depth === 0) break;
        j++;
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return -1;
}

type TplDescriptor = { prefix: string; expr: string };

function describeTrailing(literal: string): TplDescriptor | null {
  // literal includes backticks. Body without backticks.
  const body = literal.slice(1, -1);
  // Single trailing ${…} interpolation only — find the LAST `${` and ensure
  // nothing follows after the matching `}`.
  const dollarIdx = body.lastIndexOf('${');
  if (dollarIdx === -1) return null;
  // Find matching `}`.
  let depth = 1;
  let close = dollarIdx + 2;
  while (close < body.length && depth > 0) {
    const ch = body[close]!;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) break;
    close++;
  }
  if (close >= body.length) return null;
  const head = body.slice(0, dollarIdx);
  const tail = body.slice(close + 1);
  if (tail !== '') return null;
  if (!head.endsWith('.')) return null;
  const prefix = head.slice(0, -1);
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(prefix)) return null;
  const expr = body.slice(dollarIdx + 2, close);
  if (expr.length === 0) return null;
  // Make sure the head doesn't ALSO contain another `${…}`.
  if (head.includes('${')) return null;
  return { prefix, expr };
}

type Match = {
  fnName: string;
  fnStart: number;
  litStart: number;
  litEnd: number;
  argEnd: number; // first char after closing `)` or `,`
  trailing: string; // the closing `)` / `,` and beyond
};

function findCallSites(src: string): Match[] {
  const matches: Match[] = [];
  // Look for `<id>(<backtick-literal>` patterns. Skip when literal has
  // no `${…}` (those don't fail tsc post-augmentation).
  const idRegex = /(?<![A-Za-z0-9_$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(\s*`/g;
  let m: RegExpExecArray | null;
  while ((m = idRegex.exec(src)) !== null) {
    const fnName = m[1]!;
    if (fnName === 'tDyn') continue;
    const fnStart = m.index;
    // Find the opening backtick — we matched up through the backtick.
    const tickIdx = m.index + m[0].length - 1;
    const closeTick = findClosingBacktick(src, tickIdx);
    if (closeTick === -1) continue;
    // Require at least one `${` in the body.
    const body = src.slice(tickIdx + 1, closeTick);
    if (!body.includes('${')) continue;
    // After closing tick, expect optional whitespace then `)` or `,`.
    let i = closeTick + 1;
    while (i < src.length && /\s/.test(src[i]!)) i++;
    if (src[i] !== ')' && src[i] !== ',') continue;
    matches.push({
      fnName,
      fnStart,
      litStart: tickIdx,
      litEnd: closeTick,
      argEnd: i,
      trailing: src[i]!,
    });
  }
  return matches;
}

function processFile(path: string): {
  applied: number;
  unchanged: { prefix: string; literal: string }[];
} {
  const original = readFileSync(path, 'utf8');
  let src = original;
  let applied = 0;
  const unchanged: { prefix: string; literal: string }[] = [];
  while (true) {
    const matches = findCallSites(src);
    if (matches.length === 0) break;
    let progressed = false;
    for (const match of matches) {
      const literal = src.slice(match.litStart, match.litEnd + 1);
      const desc = describeTrailing(literal);
      if (!desc) {
        unchanged.push({ prefix: '<mid-template>', literal });
        continue;
      }
      // Skip identifiers that clearly aren't translators (e.g. `String`,
      // `Number`, `JSON`, `Array`, helpers we don't recognize). Use a
      // conservative allowlist that matches the next-intl convention.
      if (!isLikelyTranslator(match.fnName)) continue;
      const before = src.slice(0, match.fnStart);
      const after = src.slice(match.argEnd);
      const interior = `${match.fnName}, '${desc.prefix}', ${desc.expr}`;
      const newSegment = `tDyn(${interior}${match.trailing === ',' ? '' : ''}`;
      src = `${before}${newSegment}${after}`;
      applied++;
      progressed = true;
      break;
    }
    if (!progressed) break;
  }
  if (src.match(/\btDyn\(/) && !src.includes("from '@/i18n/typed-keys'")) {
    src = ensureTDynImport(src);
  }
  if (src !== original) writeFileSync(path, src, 'utf8');
  return { applied, unchanged };
}

function isLikelyTranslator(name: string): boolean {
  // Translator handles in this codebase typically: t, tc, tCommon, tBulk,
  // tNs, tForm, tDialog, tApi, tCommon, tStatus, tPortal, etc.
  // Always start with `t`, then optional camelCase.
  return /^t([A-Z][A-Za-z0-9]*)?$/.test(name);
}

async function main(): Promise<void> {
  const files = await glob(SRC_GLOBS, { cwd: REPO_ROOT, absolute: true });
  files.sort();
  let totalApplied = 0;
  const reports: { path: string; applied: number; unchanged: { prefix: string; literal: string }[] }[] = [];
  for (const file of files) {
    if (file.endsWith('/typed-keys.ts')) continue;
    if (file.endsWith('/migrate-i18n-casts.ts')) continue;
    const text = readFileSync(file, 'utf8');
    if (!text.includes('`')) continue;
    const { applied, unchanged } = processFile(file);
    if (applied > 0 || unchanged.length > 0) {
      totalApplied += applied;
      reports.push({ path: file, applied, unchanged });
    }
  }
  process.stdout.write(`Converted ${totalApplied} dynamic-key sites.\n`);
  const stuck = reports.filter((r) => r.unchanged.length > 0);
  if (stuck.length > 0) {
    process.stdout.write(`\nMid-template literals left for manual review:\n`);
    for (const r of stuck) {
      process.stdout.write(`  ${r.path}\n`);
      for (const u of r.unchanged) process.stdout.write(`    - ${u.literal}\n`);
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`migrate-i18n-dynamic-keys failed: ${String(err)}\n`);
  process.exit(1);
});
