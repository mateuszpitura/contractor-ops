#!/usr/bin/env tsx
// Phase 76 D-15 — lint:scopes CLI entrypoint.
// Walks packages/integrations/src/adapters/*.ts, traces every write-capable scope
// literal to a typed-const in packages/integrations/src/scopes/*.ts, exits 1 on drift.
//
// Invoked via `pnpm lint:scopes` which prefixes `tsx` so .ts imports resolve.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { glob } from 'tinyglobby';

const Dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(Dirname, '..');

const { runScopesGuard } = await import('../packages/lint-guards/src/scopes-guard/run-guard.ts');
const { formatScopesOffences } = await import(
  '../packages/lint-guards/src/scopes-guard/format-offence.ts'
);

const adapterFiles = await glob('packages/integrations/src/adapters/*.ts', {
  cwd: ROOT,
  absolute: true,
  ignore: ['**/__tests__/**', '**/__fixtures__/**'],
});

const scopeFiles = await glob('packages/integrations/src/scopes/*.ts', {
  cwd: ROOT,
  absolute: true,
  ignore: ['**/index.ts'],
});

if (adapterFiles.length === 0) {
  console.error(
    '[lint:scopes] no adapter files found at packages/integrations/src/adapters/*.ts — refusing to silently pass',
  );
  process.exit(2);
}

const offences = runScopesGuard({ adapterFiles, scopeFiles });
if (offences.length === 0) {
  console.log(`[lint:scopes] OK: ${adapterFiles.length} adapter file(s) clean`);
  process.exit(0);
}
console.error(formatScopesOffences(offences));
process.exit(1);
