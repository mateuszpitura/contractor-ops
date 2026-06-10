#!/usr/bin/env tsx

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const Dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(Dirname, '..');

const { runArchitectureGuard } = await import(
  '../packages/lint-guards/src/architecture-guard/run-guard.ts'
);
const { formatArchitectureOffences } = await import(
  '../packages/lint-guards/src/architecture-guard/format-offence.ts'
);

const offences = runArchitectureGuard({ rootDir: ROOT });
if (offences.length > 0) {
  console.error(formatArchitectureOffences(offences));
  process.exit(1);
}

console.log('lint:architecture — OK');
