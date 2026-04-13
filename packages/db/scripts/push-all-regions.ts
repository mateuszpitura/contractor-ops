#!/usr/bin/env tsx

/**
 * Multi-region Prisma schema push.
 *
 * Iterates over all configured regional database URLs and runs `prisma db push`
 * against each. Fails fast on first error to prevent partial schema drift.
 *
 * Usage:
 *   npx tsx packages/db/scripts/push-all-regions.ts
 *   # or via npm script:
 *   cd packages/db && npm run db:push:all
 */

import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// biome-ignore lint/style/useNamingConvention: standard Node.js __dirname polyfill for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');

// Load .env from project root (handles running from packages/db via npm script)
config({ path: resolve(ROOT_DIR, '.env') });

const SCHEMA_PATH = resolve(__dirname, '../prisma/schema');

const REGION_ENV_VARS = ['DATABASE_URL_EU', 'DATABASE_URL_ME'] as const;

interface RegionResult {
  region: string;
  status: 'ok' | 'skipped' | 'failed';
  error?: string;
}

function pushRegion(envVar: string): RegionResult {
  const url = process.env[envVar];
  const region = envVar.replace('DATABASE_URL_', '');

  if (!url) {
    return { region, status: 'skipped' };
  }

  try {
    execSync(`npx prisma db push --schema=${SCHEMA_PATH}`, {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
      cwd: resolve(__dirname, '..'),
    });
    return { region, status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${region}] Schema push FAILED: ${message}`);
    return { region, status: 'failed', error: message };
  }
}

function main() {
  const results: RegionResult[] = [];

  for (const envVar of REGION_ENV_VARS) {
    const result = pushRegion(envVar);
    results.push(result);

    if (result.status === 'failed') {
      console.error('\nAborting: Schema push failed. Fix the issue and re-run.');
      process.exit(1);
    }
  }

  const hasFailed = results.some(r => r.status === 'failed');
  const hasPushed = results.some(r => r.status === 'ok');

  if (hasFailed || !hasPushed) {
    process.exit(1);
  }
}

main();
