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

// NOTE: this is a plain array (NOT Record<DataRegion>), so tsc does not force a
// US entry — it is added manually for lockstep consistency. migrateRegion
// skips-on-missing, so an unset DATABASE_URL_US locally is a no-op.
const REGIONS = ['EU', 'ME', 'US'] as const;

interface RegionResult {
  region: string;
  status: 'ok' | 'skipped' | 'failed';
  error?: string;
}

function migrateRegion(region: string): RegionResult {
  const pooledUrl = process.env[`DATABASE_URL_${region}`];

  if (!pooledUrl) {
    return { region, status: 'skipped' };
  }

  // Prefer the DIRECT (unpooled) Neon endpoint for migrations. `prisma migrate
  // deploy` takes Postgres advisory locks and runs DDL that hang or fail over
  // Neon's PgBouncer pooler; DIRECT_URL_<region> points at the unpooled host.
  // Falls back to the pooled URL when unset (fine for local/unpooled Postgres).
  // Prisma 7 dropped the schema `directUrl` field, so this override is applied
  // through DATABASE_URL, which prisma.config.ts reads for the CLI. The runtime
  // app is unaffected — it connects via @prisma/adapter-pg, not this datasource
  // URL, and the override lives only in this migrate child's env.
  const migrateUrl = process.env[`DIRECT_URL_${region}`] ?? pooledUrl;

  try {
    execFileSync(PRISMA_BIN, ['migrate', 'deploy', `--schema=${SCHEMA_PATH}`], {
      env: { ...process.env, DATABASE_URL: migrateUrl },
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

  for (const region of REGIONS) {
    const result = migrateRegion(region);
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
