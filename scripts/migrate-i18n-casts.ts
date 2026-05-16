#!/usr/bin/env tsx
/**
 * One-shot migration to remove `as Parameters<typeof t>[0]` casts across
 * `apps/web/src/`. Run after the next-intl `AppConfig.Messages`
 * augmentation is in place — the cast is no longer needed because the
 * augmented `t` is already strictly typed.
 *
 * Handled patterns (mechanical):
 *  1. Static-string cast:      t('LITERAL' as Parameters<typeof t>[0])
 *                              → t('LITERAL')
 *  2. Template-literal cast,
 *     dynamic suffix only:     t(`PREFIX.${EXPR}` as Parameters<typeof t>[0])
 *                              → tDyn(t, 'PREFIX', EXPR)
 *  3. Pass-through pattern:    t(VAR as Parameters<typeof t>[0])
 *                              → t(VAR)  (only when ts will accept it)
 *
 * Reported for manual review (cannot auto-transform safely):
 *  - Mid-template dynamic:     t(`PREFIX.${EXPR}.SUFFIX` ...)
 *  - Pass-through wrappers:    (k: string) => t(k as Parameters<typeof t>[0])
 *
 * Idempotent — re-running yields no diff once migration is complete.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'tinyglobby';

type FileEdit = {
  path: string;
  occurrences: number;
  unchanged: string[];
};

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const SRC_GLOBS = ['apps/web/src/**/*.ts', 'apps/web/src/**/*.tsx'];
const TDYN_IMPORT = "import { tDyn } from '@/i18n/typed-keys';";

const CAST = 'as Parameters<typeof t>[0]';

function findAll(haystack: string, needle: string): number[] {
  const offsets: number[] = [];
  let i = 0;
  while (true) {
    const next = haystack.indexOf(needle, i);
    if (next === -1) return offsets;
    offsets.push(next);
    i = next + needle.length;
  }
}

function matchingParenStart(src: string, closeIdx: number): number | null {
  let depth = 1;
  for (let i = closeIdx - 1; i >= 0; i--) {
    const ch = src[i];
    if (ch === ')') depth++;
    else if (ch === '(') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return null;
}

function matchingBacktickStart(src: string, endIdx: number): number | null {
  for (let i = endIdx - 1; i >= 0; i--) {
    if (src[i] === '`' && src[i - 1] !== '\\') return i;
  }
  return null;
}

type TransformResult = {
  next: string;
  applied: boolean;
  unchanged?: string;
};

function transformCast(src: string, castIdx: number): TransformResult {
  // Pattern of interest:   t(<ARG> as Parameters<typeof t>[0])
  // `castIdx` points at the `a` of `as`. Just walk back over the
  // whitespace gap to land on the last char of <ARG>.
  let argEnd = castIdx - 1;
  while (argEnd >= 0 && /\s/.test(src[argEnd]!)) argEnd--;
  if (argEnd < 0) {
    return { next: src, applied: false };
  }
  // argEnd is the last char of the ARG (inclusive).
  const argLastChar = src[argEnd]!;
  let argStart: number;
  if (argLastChar === '`') {
    // Template literal argument.
    const back = matchingBacktickStart(src, argEnd);
    if (back === null) return { next: src, applied: false };
    argStart = back;
  } else if (argLastChar === "'" || argLastChar === '"') {
    // String literal argument.
    let back = argEnd - 1;
    while (back >= 0 && src[back] !== argLastChar) back--;
    if (back < 0) return { next: src, applied: false };
    argStart = back;
  } else {
    // Identifier / property access / function call result.
    let back = argEnd;
    while (back > 0) {
      const ch = src[back - 1]!;
      if (/[A-Za-z0-9_$.\]\[?]/.test(ch)) back--;
      else if (ch === ')') {
        // function call() result — bail to manual review
        return {
          next: src,
          applied: false,
          unchanged: src.slice(back - 1, argEnd + 1),
        };
      } else break;
    }
    argStart = back;
  }
  const arg = src.slice(argStart, argEnd + 1);
  // Find the enclosing `t(`. The cast must be followed by `)` or `,` (for
  // calls with trailing args). Locate the closing `)`.
  // The argument can be wrapped in extra parens; we walk forward looking
  // for the matching `)` that closes the `t(` call.
  // For simplicity, require the immediate context: `t(<ARG> as Parameters<typeof t>[0]`
  // followed by `)` or `,` (means more args follow — leave them, just drop cast).
  // Confirm the `(` we want.
  const lookahead = src.slice(castIdx + CAST.length, castIdx + CAST.length + 64);
  const afterMatch = /^\s*([\),])/.exec(lookahead);
  if (!afterMatch) {
    return { next: src, applied: false, unchanged: src.slice(argStart, castIdx + CAST.length) };
  }
  // Build replacement based on arg shape.
  let replacement: string;
  if (argLastChar === '`') {
    // Template literal — handle subNs.${expr} pattern.
    const literal = arg;
    // Body without backticks.
    const body = literal.slice(1, -1);
    // Single dynamic interpolation at the end?
    const m = /^([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)\.\$\{([\s\S]+)\}$/.exec(
      body,
    );
    if (m) {
      const prefix = m[1]!;
      const expr = m[2]!;
      // Replace the entire `t(<arg> as cast` segment with
      // `tDyn(t, 'prefix', expr`. Caller's trailing `)` or `,` stays.
      // But we also need to swap `t(` → `tDyn(t, `.
      // Find the `t(` immediately preceding argStart.
      const tCallMatch = findEnclosingTCall(src, argStart);
      if (!tCallMatch) {
        return { next: src, applied: false, unchanged: literal };
      }
      const before = src.slice(0, tCallMatch.fnStart);
      const after = src.slice(castIdx + CAST.length);
      const fnName = tCallMatch.fnName;
      const interior = `${fnName}, '${prefix}', ${expr}`;
      const newCall = `tDyn(${interior}`;
      return { next: `${before}${newCall}${after}`, applied: true };
    }
    // Multi-segment dynamic (e.g. `a.${x}.b`) or other shape — manual.
    return { next: src, applied: false, unchanged: literal };
  }
  // String literal or identifier — just drop the cast (and the ` as ...`).
  // Replace `<arg> as Parameters<typeof t>[0]` with `<arg>`.
  const before = src.slice(0, argEnd + 1);
  const after = src.slice(castIdx + CAST.length);
  return { next: `${before}${after}`, applied: true };
}

function findEnclosingTCall(
  src: string,
  argStart: number,
): { fnStart: number; fnName: string } | null {
  // Walk back from argStart over whitespace, expecting `(`.
  let i = argStart - 1;
  while (i >= 0 && /\s/.test(src[i]!)) i--;
  if (src[i] !== '(') return null;
  // Walk back over an identifier.
  let j = i - 1;
  while (j >= 0 && /[A-Za-z0-9_$.\]\[]/.test(src[j]!)) j--;
  const fnName = src.slice(j + 1, i);
  // We expect the function name to end with `t` or `.something`. Accept
  // any callable identifier — tDyn requires a translator, but callers
  // who used the cast already had `t`-shaped functions.
  return { fnStart: j + 1, fnName };
}

function ensureTDynImport(src: string): string {
  if (src.includes("from '@/i18n/typed-keys'")) return src;
  // Find the last `;` that closes a top-of-file `import …` statement.
  // Walk forward tracking whether we're inside an import statement —
  // imports can span multiple lines (`import {\n  A,\n  B,\n} from '…';`).
  const len = src.length;
  let i = 0;
  let lastImportEnd = -1;
  // Skip leading directives (`'use client'`) and blank lines.
  while (i < len) {
    // Skip whitespace.
    while (i < len && /\s/.test(src[i]!)) i++;
    // Skip `'use ...'` / `"use ..."` directives.
    if (src[i] === "'" || src[i] === '"') {
      const quote = src[i];
      let j = i + 1;
      while (j < len && src[j] !== quote) j++;
      // Expect `;` or newline after.
      let k = j + 1;
      while (k < len && /[\s;]/.test(src[k]!) && src[k] !== '\n') k++;
      i = k;
      continue;
    }
    // Skip line comments.
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
    // Try to match an `import` statement.
    if (src.startsWith('import', i) && /\s|\{|\*|'/.test(src[i + 6] ?? '')) {
      // Walk forward to the terminating `;` (or newline-without-`;`).
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
    // First non-import top-level token — stop scanning.
    break;
  }
  if (lastImportEnd === -1) {
    return `${TDYN_IMPORT}\n${src}`;
  }
  const insertion = `\n${TDYN_IMPORT}`;
  return `${src.slice(0, lastImportEnd + 1)}${insertion}${src.slice(lastImportEnd + 1)}`;
}

function processFile(path: string): FileEdit {
  const original = readFileSync(path, 'utf8');
  let src = original;
  let applied = 0;
  const unchanged: string[] = [];
  let needsTDyn = false;
  while (true) {
    const offsets = findAll(src, CAST);
    if (offsets.length === 0) break;
    let progressed = false;
    for (const offset of offsets) {
      const result = transformCast(src, offset);
      if (result.applied) {
        if (result.next.includes('tDyn(') && !src.includes('tDyn(')) needsTDyn = true;
        if (result.next.match(/\btDyn\(/) && !original.match(/\btDyn\(/)) needsTDyn = true;
        src = result.next;
        applied++;
        progressed = true;
        break; // offsets shift after each edit; recompute.
      }
      if (result.unchanged) unchanged.push(result.unchanged);
    }
    if (!progressed) break;
  }
  // After applying all transforms, ensure tDyn import present if used.
  if (src.match(/\btDyn\(/) && !src.includes("from '@/i18n/typed-keys'")) {
    src = ensureTDynImport(src);
  }
  if (src !== original) writeFileSync(path, src, 'utf8');
  return { path, occurrences: applied, unchanged };
}

async function main(): Promise<void> {
  const files = await glob(SRC_GLOBS, { cwd: REPO_ROOT, absolute: true });
  files.sort();
  process.stdout.write(`Scanning ${files.length} TS files under ${REPO_ROOT}\n`);
  let totalApplied = 0;
  const reports: FileEdit[] = [];
  let matchedFiles = 0;
  for (const file of files) {
    if (file.endsWith('/typed-keys.ts')) continue;
    const text = readFileSync(file, 'utf8');
    if (!text.includes(CAST)) continue;
    matchedFiles++;
    const edit = processFile(file);
    totalApplied += edit.occurrences;
    if (edit.occurrences > 0 || edit.unchanged.length > 0) reports.push(edit);
  }
  process.stdout.write(`Matched ${matchedFiles} files containing the cast.\n`);
  process.stdout.write(`Migrated ${totalApplied} cast sites across ${reports.length} files.\n`);
  const stuck = reports.filter((r) => r.unchanged.length > 0);
  if (stuck.length > 0) {
    process.stdout.write(`\nManual review required (${stuck.length} files):\n`);
    for (const r of stuck) {
      process.stdout.write(`  ${r.path}\n`);
      for (const u of r.unchanged) process.stdout.write(`    - ${u}\n`);
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`migrate-i18n-casts failed: ${String(err)}\n`);
  process.exit(1);
});
