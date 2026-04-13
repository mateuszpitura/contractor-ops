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

function main() {
  const results: RegionResult[] = [];

  for (const envVar of REGION_ENV_VARS) {
    const url = process.env[envVar];
    const region = envVar.replace('DATABASE_URL_', '');

    if (!url) {
      results.push({ region, status: 'skipped' });
      continue;
    }
    try {
      execSync(`npx prisma db push --schema=${SCHEMA_PATH}`, {
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'inherit',
        cwd: resolve(__dirname, '..'),
      });
      results.push({ region, status: 'ok' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${region}] Schema push FAILED: ${message}`);
      results.push({ region, status: 'failed', error: message });
      // Fail fast — do not continue to other regions if one fails
      console.error('\nAborting: Schema push failed. Fix the issue and re-run.');
      process.exit(1);
    }
  }
  for (const r of results) {
    const _icon = r.status === 'ok' ? 'OK' : r.status === 'skipped' ? 'SKIP' : 'FAIL';
  }

  const failed = results.filter(r => r.status === 'failed');
  if (failed.length > 0) {
    process.exit(1);
  }

  const pushed = results.filter(r => r.status === 'ok');
  if (pushed.length === 0) {
    process.exit(1);
  }
}

main();
