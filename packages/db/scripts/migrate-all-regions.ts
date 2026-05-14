#!/usr/bin/env tsx

/**
 * Multi-region Prisma migration deploy.
 *
 * Iterates over all configured regional database URLs and runs
 * `prisma migrate deploy` against each. Fails fast on first error
 * to prevent partial schema drift between regions.
 *
 * Usage:
 *   npx tsx packages/db/scripts/migrate-all-regions.ts
 *   # or via npm script:
 *   cd packages/db && pnpm run db:migrate:all
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { config } from 'dotenv';
import pino from 'pino';

// F-OBS-12 — share baseOptions with the rest of the app (PII redact + ISO time).
const log = pino({ ...getBaseLoggerOptions(), name: 'migrate-all-regions' });

// biome-ignore lint/style/useNamingConvention: standard Node.js __dirname polyfill for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');

// Load .env from project root (handles running from packages/db via npm script)
config({ path: resolve(ROOT_DIR, '.env') });

const PACKAGE_DIR = resolve(__dirname, '..');
const SCHEMA_PATH = resolve(PACKAGE_DIR, 'prisma/schema');

// Use the workspace-pinned prisma binary (NOT `npx prisma`, which would
// resolve to a globally-cached newer version and produce drift).
const PRISMA_BIN = resolve(PACKAGE_DIR, 'node_modules', '.bin', 'prisma');

const REGION_ENV_VARS = ['DATABASE_URL_EU', 'DATABASE_URL_ME'] as const;

interface RegionResult {
  region: string;
  status: 'ok' | 'skipped' | 'failed';
  error?: string;
}

function migrateRegion(envVar: string): RegionResult {
  const url = process.env[envVar];
  const region = envVar.replace('DATABASE_URL_', '');

  if (!url) {
    return { region, status: 'skipped' };
  }

  try {
    execFileSync(PRISMA_BIN, ['migrate', 'deploy', `--schema=${SCHEMA_PATH}`], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
      cwd: PACKAGE_DIR,
    });
    return { region, status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ region, err: message }, 'migrate deploy failed');
    return { region, status: 'failed', error: message };
  }
}

function main() {
  const results: RegionResult[] = [];

  for (const envVar of REGION_ENV_VARS) {
    const result = migrateRegion(envVar);
    results.push(result);

    if (result.status === 'failed') {
      log.error({}, 'aborting: migration failed. fix the issue and re-run.');
      process.exit(1);
    }
  }

  const hasMigrated = results.some(r => r.status === 'ok');

  if (!hasMigrated) {
    log.error({}, 'no regions were migrated — check DATABASE_URL_* env vars');
    process.exit(1);
  }
}

main();
