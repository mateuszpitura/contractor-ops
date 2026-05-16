#!/usr/bin/env tsx
/**
 * Wrap pass-through translator calls (`t(stringExpr)`) in `tKey(t, ...)`
 * so the global next-intl augmentation is satisfied without restoring
 * the forbidden `as Parameters<typeof t>[0]` cast pattern.
 *
 * Drives off tsc output:
 *   src/foo.tsx(L,C): error TS2345: Argument of type 'string' is not
 *   assignable to parameter of type 'NamespacedMessageKeys<...>'.
 *
 * For each such hit, inspect the line and rewrite the closest enclosing
 * `<identifier>(<expr>)` into `tKey(<identifier>, <expr>)`. Skip the line
 * silently when the identifier looks unlike a translator.
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

function parseStringToNamespacedErrors(out: string): ErrorLoc[] {
  const errors: ErrorLoc[] = [];
  for (const line of out.split('\n')) {
    const match = /^src\/(.+)\((\d+),(\d+)\): error TS2345: Argument of type 'string' is not assignable to parameter of type 'NamespacedMessageKeys/.exec(line);
    if (!match) continue;
    errors.push({
      file: resolve(WEB_ROOT, 'src', match[1]!),
      line: Number(match[2]),
      col: Number(match[3]),
    });
  }
  return errors;
}

function isLikelyTranslator(name: string): boolean {
  return /^t([A-Z][A-Za-z0-9]*)?$/.test(name);
}

function rewriteCall(line: string, col: number): { next: string; changed: boolean } {
  // col is 1-based, points at the start of the argument expression.
  // Walk backwards to find the matching `(` and the translator identifier.
  const idx = col - 1;
  let openIdx = -1;
  for (let i = idx - 1; i >= 0; i--) {
    const ch = line[i]!;
    if (ch === '(') {
      openIdx = i;
      break;
    }
    if (!/\s/.test(ch)) {
      // Some character lies between idx and `(`. Bail.
      return { next: line, changed: false };
    }
  }
  if (openIdx === -1) return { next: line, changed: false };
  // Walk back to find identifier.
  let nameEnd = openIdx - 1;
  while (nameEnd >= 0 && /\s/.test(line[nameEnd]!)) nameEnd--;
  let nameStart = nameEnd;
  while (nameStart > 0 && /[A-Za-z0-9_$]/.test(line[nameStart - 1]!)) nameStart--;
  const fnName = line.slice(nameStart, nameEnd + 1);
  if (!isLikelyTranslator(fnName)) return { next: line, changed: false };
  // Replace `<fnName>(` with `tKey(<fnName>, `.
  const before = line.slice(0, nameStart);
  const after = line.slice(openIdx + 1);
  const next = `${before}tKey(${fnName}, ${after}`;
  return { next, changed: true };
}

function ensureTKeyImport(src: string): string {
  if (src.includes('tKey,') || /import \{[^}]*\btKey\b[^}]*\} from '@\/i18n\/typed-keys'/.test(src)) {
    return src;
  }
  if (/from '@\/i18n\/typed-keys'/.test(src)) {
    return src.replace(
      /import \{ ([^}]+) \} from '@\/i18n\/typed-keys';/,
      (_, names: string) => {
        const set = new Set(names.split(',').map((n) => n.trim()));
        set.add('tKey');
        return `import { ${Array.from(set).sort().join(', ')} } from '@/i18n/typed-keys';`;
      },
    );
  }
  // No prior import — place after the last top-level import statement.
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
  const insertion = "\nimport { tKey } from '@/i18n/typed-keys';";
  if (lastImportEnd === -1) return `${insertion.slice(1)}\n${src}`;
  return `${src.slice(0, lastImportEnd + 1)}${insertion}${src.slice(lastImportEnd + 1)}`;
}

function main(): void {
  const tscOut = runTsc();
  const errors = parseStringToNamespacedErrors(tscOut);
  const grouped = new Map<string, ErrorLoc[]>();
  for (const err of errors) {
    if (!grouped.has(err.file)) grouped.set(err.file, []);
    grouped.get(err.file)!.push(err);
  }
  let totalLines = 0;
  let totalFiles = 0;
  for (const [file, locs] of grouped) {
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    let touched = false;
    // Sort desc by col so multiple per line still work.
    locs.sort((a, b) => b.line - a.line || b.col - a.col);
    for (const loc of locs) {
      const idx = loc.line - 1;
      const original = lines[idx];
      if (original === undefined) continue;
      const { next, changed } = rewriteCall(original, loc.col);
      if (changed) {
        lines[idx] = next;
        totalLines++;
        touched = true;
      }
    }
    if (touched) {
      const joined = lines.join('\n');
      const withImport = ensureTKeyImport(joined);
      writeFileSync(file, withImport, 'utf8');
      totalFiles++;
    }
  }
  process.stdout.write(`Wrapped ${totalLines} pass-through calls in tKey across ${totalFiles} files.\n`);
}

main();
