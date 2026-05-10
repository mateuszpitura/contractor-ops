#!/usr/bin/env tsx

/**
 * R1 / NEW-AUTHZ-02 — Tenant-scope guard for raw SQL.
 *
 * Walks all first-party `.ts` sources under `apps/**\/src/**` and
 * `packages/**\/src/**` and flags every `$queryRaw` / `$queryRawUnsafe`
 * template-literal body that does NOT include the literal token
 * `organization_id` or `organizationId` (i.e. a tenant predicate).
 *
 * Prisma's tenant + soft-delete extension (`packages/db/src/tenant.ts`) does
 * NOT intercept raw SQL — every raw query MUST hand-write the tenant
 * predicate, or explicitly opt out with `// safe-raw-sql: <reason>` on the
 * line above for legitimate cross-tenant queries (health probes, advisory
 * locks, outbox workers, etc.).
 *
 * Parsing strategy: string scan. We locate every occurrence of `$queryRaw`
 * or `$queryRawUnsafe`, advance past optional generics + `(`, then read
 * the balanced template literal or parenthesised argument list. AST parsing
 * is overkill for v1 — the surface here is ~20 callsites repo-wide.
 *
 * Exit codes:
 *   0 — every callsite either has a tenant predicate or is annotated.
 *   1 — one or more callsites missing both predicate and annotation.
 *
 * Pipeline: wired into the root `pnpm run lint:raw-sql` script, invoked by
 * `.husky/pre-push`.
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

const TENANT_PREDICATE_PATTERN = /organization[_]?id/i;
const ANNOTATION_PATTERN = /\/\/\s*safe-raw-sql:\s*\S/;
const CALL_PATTERN = /\$queryRaw(?:Unsafe)?\b/g;

/**
 * Names of interpolated `Prisma.sql` builders that are commonly used to
 * inject pre-built tenant-scoped WHERE clauses (e.g. `whereSql`,
 * `tenantFilterSql`, `sqlConditions`). When the SQL body interpolates one
 * of these, we treat it as tenant-scoped iff the same source file also
 * contains a literal `organizationId` token somewhere — i.e. the builder
 * is defined nearby and includes the predicate.
 *
 * This handles the Prisma.sql composition pattern (see
 * `routers/core/approval.ts:listPending` for the canonical example).
 */
const COMPOSABLE_SQL_VAR_PATTERN = /\$\{[^}]*\b(where|filter|condition|tenant|scope)\w*\s*\}/i;

interface Offence {
  file: string;
  line: number;
  callee: string;
  preview: string;
}

/**
 * Reads a "balanced" body of a raw-SQL call starting at `start` in `src`.
 *
 * `start` points at the character immediately after the `$queryRaw[Unsafe]`
 * identifier. Skips optional `<...>` generics, then captures either:
 *   - a tagged template body `` `...` ``, or
 *   - the contents of a `(...)` argument list (for `$queryRawUnsafe(...)`).
 *
 * Brace/quote/comment awareness is good enough to avoid pathological false
 * positives in the SQL string itself.
 */
function captureBody(src: string, start: number): { body: string; endIndex: number } | null {
  let i = start;
  const n = src.length;

  // Skip whitespace.
  while (i < n && /\s/.test(src[i]!)) i++;

  // Skip optional generic `<...>` — naive bracket count is fine because TS
  // generics inside the type args do not contain unmatched `>` runs in
  // this codebase.
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
    // Tagged template body.
    let j = i + 1;
    while (j < n) {
      const c = src[j]!;
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '$' && src[j + 1] === '{') {
        // Skip interpolation — keep simple brace counting.
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
    // `$queryRawUnsafe('...', args...)` — read the first string literal
    // (single, double, or template). Plus also include the full argument
    // text, so static SQL passed via a const variable still gets scanned
    // by virtue of its reference. The grep is permissive: we treat the
    // whole arg list as the SQL body.
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
        // Skip embedded string literal so its `(`/`)` doesn't break depth.
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
 * Returns up to `maxLines` previous non-blank lines (closest first).
 *
 * Scanning multiple lines tolerates wrapper calls — e.g.
 * `await withTimeout(prisma.$queryRaw\`SELECT 1\`, ...)` — where the
 * annotation sits two lines above the raw-SQL token itself.
 */
function previousNonBlankLines(src: string, callOffset: number, maxLines = 3): string[] {
  // Find start of the call line.
  let lineStart = callOffset;
  while (lineStart > 0 && src[lineStart - 1] !== '\n') lineStart--;

  const out: string[] = [];
  let end = lineStart - 1; // index of trailing '\n' of previous line (or -1)
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
 * Strips JS/TS comments (`//` to EOL, `/* … *\/`) but PRESERVES line breaks
 * so line numbers downstream stay accurate. Skips string/template-literal
 * contents so `// inside a string` is left intact.
 *
 * Without this pass, a doc-comment that references `db.$queryRaw` in a
 * backticked example (see `dashboard.ts` / `replica.ts` JSDocs) would
 * trip the regex.
 */
function stripComments(src: string): string {
  const out: string[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i]!;
    const nx = src[i + 1];

    // Block comment.
    if (c === '/' && nx === '*') {
      out.push('/*');
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        // Preserve newlines so line numbers stay aligned.
        out.push(src[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < n) {
        out.push('*/');
        i += 2;
      }
      continue;
    }

    // Line comment.
    if (c === '/' && nx === '/') {
      out.push('//');
      i += 2;
      while (i < n && src[i] !== '\n') {
        out.push(' ');
        i++;
      }
      continue;
    }

    // String / template literal — copy verbatim so embedded `//` doesn't
    // get treated as a comment, and so `$queryRaw` references inside
    // string literals aren't scanned either (they're not real calls).
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
        // For template literals, handle `${ ... }` interpolation so a `'`
        // inside an interpolated expression doesn't terminate the template.
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
  if (!rawSrc.includes('$queryRaw')) return [];

  // Strip comments first so doc/example references to `$queryRaw` in
  // JSDoc blocks (e.g. `dashboard.ts:51`, `replica.ts:267`) are not
  // mistaken for real callsites.
  const src = stripComments(rawSrc);

  // If `$queryRaw` no longer appears after comment stripping, all hits
  // were in comments — nothing to do.
  if (!src.includes('$queryRaw')) return [];

  // File-wide tenant token presence — used as a soft signal that
  // tenant-scoping is genuinely handled (in conjunction with the
  // composable-SQL-var heuristic below) for the Prisma.sql composition
  // pattern. Plain raw queries still need the predicate INSIDE the body.
  const fileHasTenantToken = TENANT_PREDICATE_PATTERN.test(rawSrc);

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
    if (TENANT_PREDICATE_PATTERN.test(body)) {
      continue;
    }

    // Composition pattern: the SQL body interpolates a pre-built filter
    // builder (e.g. `${whereSql}`, `${tenantFilter}`). Accept only when
    // the same source file references `organizationId` somewhere — i.e.
    // the builder is defined in this file and contains the predicate.
    // Future contributors who add a raw query that interpolates a `where`
    // variable but never spells out a tenant predicate ANYWHERE in the
    // file still fail.
    if (fileHasTenantToken && COMPOSABLE_SQL_VAR_PATTERN.test(body)) {
      continue;
    }

    // Look up the annotation on the ORIGINAL source — `src` has had
    // comments replaced with whitespace, which would erase the marker.
    // Line numbers are preserved by `stripComments`, so offsets line up.
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
      `[lint:raw-sql] OK: ${files.length} source file(s) scanned, all $queryRaw callsites have a tenant predicate or annotation`,
    );
    process.exit(0);
  }

  for (const o of allOffences) {
    process.stderr.write(
      `${o.file}:${o.line}: ${o.callee} body lacks 'organization_id' (or 'organizationId') predicate. Add the predicate or annotate with '// safe-raw-sql: <reason>' on the line above.\n  SQL: ${o.preview}\n`,
    );
  }
  process.stderr.write(
    `\n[lint:raw-sql] FAIL: ${allOffences.length} raw-SQL callsite(s) bypass tenant scoping without annotation.\n`,
  );
  process.exit(1);
}

await main();
