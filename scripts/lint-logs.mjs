#!/usr/bin/env tsx
// Phase 70 D-04 D-07 — lint:logs CLI entrypoint.
//
// Walks apps/** and packages/** for .ts/.tsx files, runs the ts-morph guard,
// emits .lint-logs-baseline.json on --update-baseline, and exits 1 when a
// new body-log site appears that is neither in the include-prefix allow-list
// nor in the committed baseline.

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { glob } from 'tinyglobby';

const Dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(Dirname, '..');
const BASELINE_PATH = resolve(ROOT, '.lint-logs-baseline.json');

const { runLogsGuard } = await import('../packages/lint-guards/src/logs-guard/run-guard.ts');
const { formatLogsOffences } = await import(
  '../packages/lint-guards/src/logs-guard/format-offence.ts'
);
const { LOG_BODY_INCLUDE_PREFIXES } = await import(
  '../packages/logger/src/log-body-include-prefixes.ts'
);

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update-baseline');

const files = await glob(
  [
    'apps/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/__tests__/**',
    '!**/__fixtures__/**',
    '!**/.next/**',
    '!**/generated/**',
    '!**/*.d.ts',
  ],
  { cwd: ROOT, absolute: true },
);

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(await readFile(BASELINE_PATH, 'utf-8'))
  : { offences: [] };

const baselineKeyed = (baseline.offences ?? []).map(b => ({
  file: b.file,
  line: b.line,
}));

if (updateBaseline) {
  // Rewrite baseline (manual local action only).
  const fresh = await runLogsGuard({
    files,
    includePrefixes: LOG_BODY_INCLUDE_PREFIXES,
  });
  await writeFile(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        note: 'Phase 70 D-07 audit baseline. Regenerate with: pnpm lint:logs --update-baseline',
        offences: fresh,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `[lint:logs] baseline updated: ${fresh.length} offence(s) written to .lint-logs-baseline.json`,
  );
  process.exit(0);
}

const offences = await runLogsGuard({
  files,
  includePrefixes: LOG_BODY_INCLUDE_PREFIXES,
  baseline: baselineKeyed,
});

if (offences.length === 0) {
  console.log(
    `[lint:logs] OK: ${files.length} source file(s) clean (baseline: ${baselineKeyed.length} pre-existing site(s) tolerated)`,
  );
  process.exit(0);
}

console.error(formatLogsOffences(offences));
process.exit(1);
