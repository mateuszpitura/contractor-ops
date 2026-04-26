#!/usr/bin/env tsx
// Phase 70 D-04 — lint:schema CLI entrypoint.
// Walks packages/db/prisma/schema/**/*.prisma, runs the guard, exits 1 on offence.
//
// Invoked via `pnpm lint:schema` which prefixes `tsx` so .ts imports resolve.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { glob } from 'tinyglobby';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const { runSchemaGuard } = await import(
  '../packages/lint-guards/src/schema-guard/run-guard.ts'
);
const { formatSchemaOffences } = await import(
  '../packages/lint-guards/src/schema-guard/format-offence.ts'
);

const files = await glob('packages/db/prisma/schema/**/*.prisma', {
  cwd: ROOT,
  absolute: true,
});

if (files.length === 0) {
  console.error(
    '[lint:schema] no schema files found at packages/db/prisma/schema/**/*.prisma — refusing to silently pass',
  );
  process.exit(2);
}

const offences = await runSchemaGuard({ files });
if (offences.length === 0) {
  console.log(`[lint:schema] OK: ${files.length} schema file(s) clean`);
  process.exit(0);
}
console.error(formatSchemaOffences(offences));
process.exit(1);
