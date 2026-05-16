#!/usr/bin/env tsx
/**
 * Regression guard for the i18n typed-keys cleanup. Blocks reintroduction
 * of the forbidden cast patterns under `apps/web/src/`:
 *
 *   • `as Parameters<typeof <translator>>[0]`
 *   • `as keyof IntlMessages`
 *   • `as keyof Messages`
 *
 * Run as part of the lint suite — exits non-zero with the offending file
 * locations on match. Intentionally narrow so unrelated `as Parameters<…>`
 * usages elsewhere in the codebase keep compiling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'tinyglobby';

type Hit = { file: string; line: number; col: number; pattern: string };

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const SRC_GLOBS = ['apps/web/src/**/*.ts', 'apps/web/src/**/*.tsx'];

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    // Translator identifiers follow next-intl convention: `t`, `tc`, or
    // `t` + CamelCase suffix (`tBulk`, `tCommon`, `tDetail`, …). The
    // narrow pattern keeps unrelated `Parameters<typeof someFn>[0]`
    // casts on non-translator helpers compiling.
    name: 'as Parameters<typeof <translator>>[0]',
    regex: /\bas\s+Parameters<typeof\s+(t|tc|t[A-Z][A-Za-z0-9_$]*)\s*>\s*\[\s*0\s*\]/g,
  },
  {
    name: 'as keyof IntlMessages',
    regex: /\bas\s+keyof\s+IntlMessages\b/g,
  },
  {
    name: 'as keyof Messages',
    regex: /\bas\s+keyof\s+Messages\b/g,
  },
];

function offsetToLineCol(src: string, offset: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset; i++) {
    if (src[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

async function main(): Promise<void> {
  const files = await glob(SRC_GLOBS, { cwd: REPO_ROOT, absolute: true });
  files.sort();
  const hits: Hit[] = [];
  for (const file of files) {
    if (file.endsWith('/typed-keys.ts')) continue;
    if (file.endsWith('/migrate-i18n-casts.ts')) continue;
    const src = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(src)) !== null) {
        const { line, col } = offsetToLineCol(src, match.index);
        hits.push({
          file: file.slice(REPO_ROOT.length + 1),
          line,
          col,
          pattern: pattern.name,
        });
      }
    }
  }
  if (hits.length === 0) {
    process.stdout.write('lint-i18n-casts: 0 violations.\n');
    return;
  }
  process.stderr.write(
    `lint-i18n-casts: ${hits.length} forbidden cast(s) found — migrate via @/i18n/typed-keys helpers (tDyn / tDynLoose / tKey / tHas) instead.\n\n`,
  );
  for (const hit of hits) {
    process.stderr.write(`  ${hit.file}:${hit.line}:${hit.col}  ${hit.pattern}\n`);
  }
  process.exit(1);
}

main().catch((err: unknown) => {
  process.stderr.write(`lint-i18n-casts failed: ${String(err)}\n`);
  process.exit(2);
});
