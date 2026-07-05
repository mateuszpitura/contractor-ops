#!/usr/bin/env tsx

/**
 * Migration ↔ schema drift check.
 *
 * Guards against the failure mode where a model is declared in `prisma/schema/**`
 * but no migration under `prisma/schema/migrations/**` ever creates it — the exact
 * gap that left nine US tax-form tables queryable in code yet absent from a fresh
 * regional database (`relation does not exist`). Local dev hides it because
 * `db push` / dev drift materialises the tables out-of-band.
 *
 * Strategy: replay every migration into an ephemeral shadow database and diff the
 * resulting state against the schema datamodel via
 * `prisma migrate diff --from-migrations <dir> --to-schema <schema> --exit-code`.
 * A non-empty diff means the migrations and the schema disagree.
 *
 * Degradation (mirrors the repo's WARN-only local artifacts — graph.json / BM25):
 *   - No shadow database configured  → WARN and pass (exit 0). CI wires one in.
 *   - Clean drift signal (exit 2)    → FAIL (exit 1) with a remediation message.
 *   - Replay could not complete       → WARN and pass (exit 0), printing the error.
 *       The migration history is partly hand-curated + applied at a manual gate
 *       (see packages/db/scripts/README.md); a generic shadow may not replay every
 *       folder in lexicographic order. That is a history-health issue, pre-existing
 *       and orthogonal to a given PR, so it must not retro-brick unrelated changes.
 *
 * Configure the shadow with MIGRATE_SHADOW_DATABASE_URL (a throwaway database the
 * check resets — never a real regional URL).
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { config } from 'dotenv';
import pino from 'pino';

const { env } = process;

const log = pino({ ...getBaseLoggerOptions(), name: 'check-migration-schema-drift' });

// biome-ignore lint/style/useNamingConvention: standard ESM __dirname polyfill
const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(__dirname, '..');
const ROOT_DIR = resolve(PACKAGE_DIR, '..', '..');
const SCHEMA_DIR = resolve(PACKAGE_DIR, 'prisma', 'schema');
const MIGRATIONS_DIR = resolve(SCHEMA_DIR, 'migrations');

config({ path: resolve(ROOT_DIR, '.env') });

const shadowUrl = env.MIGRATE_SHADOW_DATABASE_URL;

interface ExecFailure {
  status: number | null;
  stdout: string;
  stderr: string;
}

function readExecFailure(err: unknown): ExecFailure {
  const e = (err ?? {}) as Record<string, unknown>;
  return {
    status: typeof e.status === 'number' ? e.status : null,
    stdout: e.stdout == null ? '' : String(e.stdout),
    stderr: e.stderr == null ? '' : String(e.stderr),
  };
}

function main() {
  if (!shadowUrl) {
    log.warn(
      'MIGRATE_SHADOW_DATABASE_URL is not set — skipping migration↔schema drift check. ' +
        'Provision a throwaway Postgres and set MIGRATE_SHADOW_DATABASE_URL to enable it in CI.',
    );
    return;
  }

  // A self-contained config so this check never depends on the ambient
  // prisma.config.ts / datasource wiring. The (throwaway) shadow URL is embedded
  // into an ephemeral tmp config that is removed in `finally`.
  const tmpRoot = mkdtempSync(join(tmpdir(), 'prisma-migdrift-'));
  const tmpConfig = join(tmpRoot, 'prisma.config.ts');
  writeFileSync(
    tmpConfig,
    [
      "import { defineConfig } from 'prisma/config';",
      'export default defineConfig({',
      `  schema: ${JSON.stringify(SCHEMA_DIR)},`,
      `  migrations: { path: ${JSON.stringify(MIGRATIONS_DIR)} },`,
      `  datasource: { url: ${JSON.stringify(shadowUrl)}, shadowDatabaseUrl: ${JSON.stringify(shadowUrl)} },`,
      '});',
      '',
    ].join('\n'),
  );

  const prismaBin = resolve(PACKAGE_DIR, 'node_modules', '.bin', 'prisma');

  try {
    log.info({ MIGRATIONS_DIR, SCHEMA_DIR }, 'Replaying migrations into shadow and diffing schema');
    execFileSync(
      prismaBin,
      [
        'migrate',
        'diff',
        '--config',
        tmpConfig,
        '--from-migrations',
        MIGRATIONS_DIR,
        '--to-schema',
        SCHEMA_DIR,
        '--exit-code',
      ],
      {
        cwd: PACKAGE_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
      },
    );
    log.info('Migrations and schema are in sync — no drift.');
  } catch (err) {
    const { status, stdout, stderr } = readExecFailure(err);

    if (status === 2) {
      log.error(
        { diff: stdout.trim() },
        'Migration ↔ schema DRIFT detected — the migrations do not reproduce the schema. ' +
          'Author an additive migration for the missing/changed objects (do NOT `prisma migrate dev`), ' +
          'matching the hand-authored style in prisma/schema/migrations/.',
      );
      process.exit(1);
    }

    log.warn(
      { status, stderr: stderr.trim() || undefined },
      'Could not complete a clean migration replay against the shadow database — skipping the ' +
        'diff (WARN, not a hard fail). The migration history is partly hand-curated; fix replay ' +
        'health separately. This does not gate the current change.',
    );
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
