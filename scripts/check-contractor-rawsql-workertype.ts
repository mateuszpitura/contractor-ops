#!/usr/bin/env tsx

/**
 * Worker-type guard for raw SQL that reads the Contractor table.
 *
 * Walks all first-party `.ts` sources under `apps/**\/src/**` and
 * `packages/**\/src/**` and flags every `$queryRaw` / `$queryRawUnsafe` /
 * `$executeRaw` / `$executeRawUnsafe` body that reads `FROM "Contractor"`
 * without either a `workerType` predicate OR an explicit opt-out annotation.
 *
 * Why this exists: the `withWorkerTypeDefault` Prisma extension
 * (`packages/db/src/worker-type.ts`) injects the `workerType = 'CONTRACTOR'`
 * discriminator on Worker reads, but Prisma query extensions do NOT intercept
 * raw SQL — the callback receives `model: undefined`. A raw `FROM "Contractor"`
 * read therefore bypasses the discriminator entirely. Under the current model
 * the Contractor table is inherently contractor-only (the discriminator lives
 * on the Worker base table, not on Contractor), so the known sites are safe and
 * are annotated with `// contractor-only-raw-sql: <reason>`. This guard exists
 * so any NEW raw `FROM "Contractor"` read cannot silently ship without either a
 * `workerType` predicate or a reviewed annotation.
 *
 * Parsing strategy: string scan, mirroring `check-raw-sql-tenant-scoped.ts`.
 * We locate every raw-SQL call, advance past optional generics + `(`, read the
 * balanced template literal or parenthesised argument list, then test the body.
 *
 * Exit codes:
 *   0 — every `FROM "Contractor"` raw read has a workerType predicate or annotation.
 *   1 — one or more reads bypass the discriminator without annotation.
 *
 * Pipeline: wired into the root `pnpm run lint:ci` chain next to `lint:raw-sql`.
 */

import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { glob } from 'tinyglobby';

const Dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(Dirname, '..');

const SOURCE_GLOBS = ['apps/**/src/**/*.ts', 'packages/**/src/**/*.ts'];

const EXCLUDE_GLOBS = [
  '!**/node_modules/**',
  '!**/dist/**',
  '!**/.next/**',
  '!**/generated/**',
  '!**/__tests__/**',
  '!**/__fixtures__/**',
  '!**/__mocks__/**',
  '!**/*.test.ts',
  '!**/*.spec.ts',
  '!**/*.d.ts',
];

// Detects a read against the Contractor table: `FROM "Contractor"` (Prisma
// quotes table names). Tolerant of surrounding whitespace; case-insensitive on
// the FROM keyword only.
const FROM_CONTRACTOR_PATTERN = /\bfrom\s+"Contractor"/i;
const WORKER_TYPE_PREDICATE_PATTERN = /workerType/;
const ANNOTATION_PATTERN = /\/\/\s*contractor-only-raw-sql:\s*\S/;
const CALL_PATTERN = /\$(?:queryRaw|executeRaw)(?:Unsafe)?\b/g;

interface Offence {
  file: string;
  line: number;
  callee: string;
  preview: string;
}

/**
 * Reads a "balanced" body of a raw-SQL call starting at `start` in `src`.
 *
 * `start` points at the character immediately after the raw-SQL identifier.
 * Skips optional `<...>` generics, then captures either a tagged template body
 * `` `...` `` or the contents of a `(...)` argument list.
 */
function captureBody(src: string, start: number): { body: string; endIndex: number } | null {
  let i = start;
  const n = src.length;

  while (i < n && /\s/.test(src[i]!)) i++;

  if (i < n && src[i] === '<') {
    let depth = 0;
    while (i < n) {
      const c = src[i]!;
      if (c === '<') depth++;
      else if (c === '>') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    while (i < n && /\s/.test(src[i]!)) i++;
  }

  if (i >= n) return null;

  const opener = src[i];
  if (opener === '`') {
    let j = i + 1;
    while (j < n) {
      const c = src[j]!;
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '$' && src[j + 1] === '{') {
        let depth = 1;
        j += 2;
        while (j < n && depth > 0) {
          const cc = src[j]!;
          if (cc === '{') depth++;
          else if (cc === '}') depth--;
          j++;
        }
        continue;
      }
      if (c === '`') {
        return { body: src.slice(i + 1, j), endIndex: j + 1 };
      }
      j++;
    }
    return null;
  }

  if (opener === '(') {
    let depth = 1;
    let j = i + 1;
    const bodyStart = j;
    while (j < n && depth > 0) {
      const c = src[j]!;
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) {
          return { body: src.slice(bodyStart, j), endIndex: j + 1 };
        }
      } else if (c === '`' || c === '"' || c === "'") {
        const quote = c;
        j++;
        while (j < n) {
          if (src[j] === '\\') {
            j += 2;
            continue;
          }
          if (src[j] === quote) break;
          j++;
        }
      }
      j++;
    }
    return null;
  }

  // Not a callable form (e.g. `type RawQueryClient = Pick<PrismaClient, '$queryRaw'>;`).
  return null;
}

function lineNumberAt(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src[i] === '\n') line++;
  }
  return line;
}

/**
 * Returns up to `maxLines` previous non-blank lines (closest first) so a wrapper
 * call (e.g. `await withTimeout(db.$queryRaw\`…\`, …)`) still finds an annotation
 * placed a line or two above the raw-SQL token.
 */
function previousNonBlankLines(src: string, callOffset: number, maxLines = 3): string[] {
  let lineStart = callOffset;
  while (lineStart > 0 && src[lineStart - 1] !== '\n') lineStart--;

  const out: string[] = [];
  let end = lineStart - 1;
  while (end >= 0 && out.length < maxLines) {
    let begin = end;
    while (begin > 0 && src[begin - 1] !== '\n') begin--;
    const text = src.slice(begin, end);
    if (text.trim().length > 0) {
      out.push(text);
    }
    end = begin - 1;
  }
  return out;
}

/**
 * Strips JS/TS comments (`//` to EOL, `/* … *\/`) but PRESERVES line breaks so
 * downstream line numbers stay accurate. Skips string/template-literal contents
 * so a `$queryRaw` reference inside a JSDoc backticked example is not mistaken
 * for a real callsite.
 */
function stripComments(src: string): string {
  const out: string[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i]!;
    const nx = src[i + 1];

    if (c === '/' && nx === '*') {
      out.push('/*');
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out.push(src[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < n) {
        out.push('*/');
        i += 2;
      }
      continue;
    }

    if (c === '/' && nx === '/') {
      out.push('//');
      i += 2;
      while (i < n && src[i] !== '\n') {
        out.push(' ');
        i++;
      }
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out.push(c);
      i++;
      while (i < n) {
        const cc = src[i]!;
        out.push(cc);
        if (cc === '\\') {
          if (i + 1 < n) out.push(src[i + 1]!);
          i += 2;
          continue;
        }
        if (cc === quote) {
          i++;
          break;
        }
        if (quote === '`' && cc === '$' && src[i + 1] === '{') {
          out.push('{');
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            const ic = src[i]!;
            out.push(ic);
            if (ic === '{') depth++;
            else if (ic === '}') depth--;
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }

    out.push(c);
    i++;
  }
  return out.join('');
}

async function scanFile(absPath: string): Promise<Offence[]> {
  const rawSrc = await readFile(absPath, 'utf-8');
  if (!(rawSrc.includes('$queryRaw') || rawSrc.includes('$executeRaw'))) return [];

  const src = stripComments(rawSrc);

  if (!(src.includes('$queryRaw') || src.includes('$executeRaw'))) return [];

  const offences: Offence[] = [];
  const pattern = new RegExp(CALL_PATTERN.source, 'g');

  for (let match = pattern.exec(src); match !== null; match = pattern.exec(src)) {
    const callee = match[0]!;
    const afterIdent = match.index + callee.length;

    const captured = captureBody(src, afterIdent);
    if (!captured) {
      // Not a real invocation (could be a type reference, mock setup, etc.).
      continue;
    }

    const body = captured.body;

    // Only reads against the Contractor table are in scope.
    if (!FROM_CONTRACTOR_PATTERN.test(body)) {
      continue;
    }

    // An inline workerType predicate makes the read explicitly discriminated.
    if (WORKER_TYPE_PREDICATE_PATTERN.test(body)) {
      continue;
    }

    // Look up the annotation on the ORIGINAL source — `src` has had comments
    // replaced with whitespace, which would erase the marker. Line numbers are
    // preserved by `stripComments`, so offsets line up.
    const prevLines = previousNonBlankLines(rawSrc, match.index, 3);
    if (prevLines.some(line => ANNOTATION_PATTERN.test(line))) {
      continue;
    }

    offences.push({
      file: relative(ROOT, absPath),
      line: lineNumberAt(src, match.index),
      callee,
      preview: body.replace(/\s+/g, ' ').trim().slice(0, 120),
    });
  }

  return offences;
}

async function main(): Promise<void> {
  const files = await glob([...SOURCE_GLOBS, ...EXCLUDE_GLOBS], {
    cwd: ROOT,
    absolute: true,
  });

  const allOffences: Offence[] = [];
  for (const file of files) {
    const offences = await scanFile(file);
    allOffences.push(...offences);
  }

  if (allOffences.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[check:contractor-rawsql-workertype] OK: ${files.length} source file(s) scanned, every raw FROM "Contractor" read has a workerType predicate or annotation`,
    );
    process.exit(0);
  }

  for (const o of allOffences) {
    process.stderr.write(
      `${o.file}:${o.line}: ${o.callee} reads FROM "Contractor" without a 'workerType' predicate. Add the predicate or annotate with '// contractor-only-raw-sql: <reason>' on the line above.\n  SQL: ${o.preview}\n`,
    );
  }
  process.stderr.write(
    `\n[check:contractor-rawsql-workertype] FAIL: ${allOffences.length} raw FROM "Contractor" read(s) bypass the worker-type discriminator without annotation.\n`,
  );
  process.exit(1);
}

await main();
