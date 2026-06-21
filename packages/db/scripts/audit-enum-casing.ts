#!/usr/bin/env tsx

/**
 * Audits every Prisma `enum` value in `packages/db/prisma/schema/**.prisma`
 * against `UPPER_SNAKE_CASE`. Exits non-zero (and lists offenders) when any
 * enum value does not match `^[A-Z][A-Z0-9_]*$`.
 *
 * Wired as `pnpm --filter @contractor-ops/db db:audit-enum-casing` and used
 * as the gate in the dropdown-normalization workstream — see
 * `goals/dropdown-normalization/plan.md` Step 1.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SCHEMA_DIR = join(import.meta.dirname, '..', 'prisma', 'schema');
const UPPER_SNAKE = /^[A-Z][A-Z0-9_]*$/;

interface Offender {
  file: string;
  line: number;
  enumName: string;
  value: string;
}

function listSchemaFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.prisma'))
    .map(entry => join(dir, entry.name));
}

type EnumLine =
  | { kind: 'skip' }
  | { kind: 'enter'; enumName: string }
  | { kind: 'exit' }
  | { kind: 'value'; value: string };

/**
 * Classify a single stripped (comment-free) schema line relative to whether we
 * are currently inside an `enum <Name> {` block. Pure — holds no parser state.
 */
function classifyEnumLine(stripped: string, insideEnum: boolean): EnumLine {
  if (!insideEnum) {
    const open = stripped.match(/^enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
    return open ? { kind: 'enter', enumName: open[1] } : { kind: 'skip' };
  }

  if (stripped === '}') return { kind: 'exit' };
  if (stripped.startsWith('@@')) return { kind: 'skip' }; // block attrs (e.g. `@@map`)

  const valueMatch = stripped.match(/^([A-Za-z_][A-Za-z0-9_]*)\b/);
  return valueMatch ? { kind: 'value', value: valueMatch[1] } : { kind: 'skip' };
}

/**
 * Walks lines and tracks the enclosing `enum <Name> {` block so values
 * outside enum blocks (model fields, types, comments) are ignored.
 */
function findOffenders(file: string): Offender[] {
  const lines = readFileSync(file, 'utf8').split('\n');
  const offenders: Offender[] = [];
  let currentEnum: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const stripped = lines[i].replace(/\/\/.*$/, '').trim();
    if (stripped.length === 0) continue;

    const classified = classifyEnumLine(stripped, currentEnum !== null);

    if (classified.kind === 'enter') {
      currentEnum = classified.enumName;
    } else if (classified.kind === 'exit') {
      currentEnum = null;
    } else if (classified.kind === 'value' && currentEnum !== null) {
      if (!UPPER_SNAKE.test(classified.value)) {
        offenders.push({ file, line: i + 1, enumName: currentEnum, value: classified.value });
      }
    }
  }

  return offenders;
}

function main(): void {
  const files = listSchemaFiles(SCHEMA_DIR);
  const offenders = files.flatMap(findOffenders);

  if (offenders.length === 0) {
    process.stdout.write('audit-enum-casing: all enum values match ^[A-Z][A-Z0-9_]*$\n');
    return;
  }

  process.stderr.write(`audit-enum-casing: ${offenders.length} offender(s) found:\n`);
  for (const o of offenders) {
    const rel = relative(process.cwd(), o.file);
    process.stderr.write(`  ${rel}:${o.line}  enum ${o.enumName}  value=${o.value}\n`);
  }
  process.exit(1);
}

main();
