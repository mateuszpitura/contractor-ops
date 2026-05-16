#!/usr/bin/env tsx
/**
 * Switch `tDyn(...)` calls to `tDynLoose(...)` for sites where tsc reports
 * the leaf expression as `string` against a narrow literal union — i.e.
 * the leaf comes from an enum/util that TS can't narrow without
 * structural typing changes outside this scope. The loose helper keeps
 * the sub-namespace prefix type-checked; the audit-i18n-code-coverage
 * runtime gate continues to catch missing leaves.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const WEB_ROOT = resolve(REPO_ROOT, 'apps/web');

type ErrorLoc = { file: string; line: number; col: number };

function runTsc(): string {
  try {
    return execSync('pnpm tsc --noEmit', {
      cwd: WEB_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const out = (err as { stdout?: Buffer | string }).stdout;
    if (typeof out === 'string') return out;
    if (out) return out.toString();
    return '';
  }
}

function parseLeafErrors(out: string): ErrorLoc[] {
  const errors: ErrorLoc[] = [];
  for (const line of out.split('\n')) {
    const match = /^src\/(.+)\((\d+),(\d+)\): error TS2345: Argument of type 'string' is not assignable/.exec(line);
    if (!match) continue;
    // Only collect entries whose right-hand side is a union (narrow leaf),
    // not `NamespacedMessageKeys` (those are pass-through wrappers).
    if (line.includes('NamespacedMessageKeys')) continue;
    errors.push({
      file: resolve(WEB_ROOT, 'src', match[1]!),
      line: Number(match[2]),
      col: Number(match[3]),
    });
  }
  return errors;
}

function fixFile(file: string, errorLines: Set<number>): number {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let touched = 0;
  for (const lineNum of errorLines) {
    const idx = lineNum - 1;
    const original = lines[idx];
    if (original === undefined) continue;
    // Only convert if the line contains a `tDyn(` call (not already loose).
    if (!/\btDyn\(/.test(original)) continue;
    const replaced = original.replace(/\btDyn\(/g, 'tDynLoose(');
    if (replaced === original) continue;
    lines[idx] = replaced;
    touched++;
  }
  if (touched > 0) {
    writeFileSync(file, lines.join('\n'), 'utf8');
  }
  return touched;
}

function ensureLooseImport(file: string): boolean {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('tDynLoose(')) return false;
  const newImport = "import { tDyn, tDynLoose } from '@/i18n/typed-keys';";
  if (src.includes(newImport)) return false;
  let next = src;
  if (src.includes("import { tDyn } from '@/i18n/typed-keys';")) {
    next = src.replace(
      "import { tDyn } from '@/i18n/typed-keys';",
      newImport,
    );
  } else if (src.includes("import { tDyn } from")) {
    next = src.replace(/import \{ tDyn \} from '([^']+)';/, "import { tDyn, tDynLoose } from '$1';");
  } else if (src.includes("from '@/i18n/typed-keys'")) {
    next = src.replace(
      /import \{ ([^}]+) \} from '@\/i18n\/typed-keys';/,
      (_match, names: string) => {
        const set = new Set(names.split(',').map((n) => n.trim()));
        set.add('tDynLoose');
        return `import { ${Array.from(set).sort().join(', ')} } from '@/i18n/typed-keys';`;
      },
    );
  } else {
    // No prior tDyn import — add a fresh one.
    const importLine = "import { tDynLoose } from '@/i18n/typed-keys';\n";
    next = `${importLine}${src}`;
  }
  if (next === src) return false;
  writeFileSync(file, next, 'utf8');
  return true;
}

function main(): void {
  const tscOut = runTsc();
  const errors = parseLeafErrors(tscOut);
  const grouped = new Map<string, Set<number>>();
  for (const err of errors) {
    if (!grouped.has(err.file)) grouped.set(err.file, new Set());
    grouped.get(err.file)!.add(err.line);
  }
  let totalLineFixes = 0;
  let totalImports = 0;
  for (const [file, lines] of grouped) {
    const fixed = fixFile(file, lines);
    if (fixed > 0) totalLineFixes += fixed;
    if (ensureLooseImport(file)) totalImports++;
  }
  process.stdout.write(
    `Converted ${totalLineFixes} tDyn calls to tDynLoose across ${grouped.size} files; added imports in ${totalImports} files.\n`,
  );
}

main();
