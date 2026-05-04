#!/usr/bin/env tsx

/**
 * Prisma client drift check.
 *
 * Verifies that the committed `src/generated/prisma/client/**` is byte-identical
 * to what `prisma generate` would emit from the current `prisma/schema/**`.
 *
 * Used in CI to fail PRs that change schema without re-running `pnpm db:generate`,
 * AND to skip the unconditional regen step (we trust the committed output and
 * only verify it hasn't drifted from the schema).
 *
 * Strategy: copy the schema dir to a tmp location, rewrite the generator's
 * `output` to a tmp dir, run `prisma generate --schema=<tmp>/schema`, then
 * recursively compare file lists + content hashes against the committed dir.
 *
 * Exits 0 on match, 1 on drift (with a clear remediation message).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { config } from 'dotenv';
import pino from 'pino';

// F-OBS-12 — use shared baseOptions so the script keeps the same PII redact,
// timestamps, and level config as the rest of the app instead of drifting.
const log = pino({ ...getBaseLoggerOptions(), name: 'check-generated-drift' });

// biome-ignore lint/style/useNamingConvention: standard ESM __dirname polyfill
const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = resolve(__dirname, '..');
const ROOT_DIR = resolve(PACKAGE_DIR, '..', '..');
const COMMITTED_DIR = resolve(PACKAGE_DIR, 'src', 'generated', 'prisma', 'client');
const SCHEMA_SRC_DIR = resolve(PACKAGE_DIR, 'prisma', 'schema');

config({ path: resolve(ROOT_DIR, '.env') });

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out.sort();
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function buildManifest(dir: string): Map<string, string> {
  const manifest = new Map<string, string>();
  for (const file of listFilesRecursive(dir)) {
    manifest.set(relative(dir, file), hashFile(file));
  }
  return manifest;
}

function diffManifests(
  committed: Map<string, string>,
  fresh: Map<string, string>,
): { onlyInCommitted: string[]; onlyInFresh: string[]; changed: string[] } {
  const onlyInCommitted: string[] = [];
  const onlyInFresh: string[] = [];
  const changed: string[] = [];

  for (const [path, hash] of committed) {
    const freshHash = fresh.get(path);
    if (freshHash === undefined) {
      onlyInCommitted.push(path);
    } else if (freshHash !== hash) {
      changed.push(path);
    }
  }
  for (const path of fresh.keys()) {
    if (!committed.has(path)) onlyInFresh.push(path);
  }

  return { onlyInCommitted, onlyInFresh, changed };
}

function main() {
  // Mirror the package's relative layout inside a tmp tree so the schema's
  // `output = "../../src/generated/prisma/client"` resolves to a tmp location
  // WITHOUT us rewriting the schema text (Prisma embeds the schema verbatim
  // as `inlineSchema` in the runtime; rewriting would bake the tmp path in
  // and produce a false drift signal).
  const tmpRoot = mkdtempSync(join(tmpdir(), 'prisma-drift-'));
  const tmpSchemaDir = join(tmpRoot, 'prisma', 'schema');
  const tmpOutDir = join(tmpRoot, 'src', 'generated', 'prisma', 'client');

  try {
    mkdirSync(join(tmpRoot, 'prisma'), { recursive: true });
    cpSync(SCHEMA_SRC_DIR, tmpSchemaDir, { recursive: true });

    // Use the workspace-pinned prisma binary (NOT `npx prisma`, which would
    // resolve to a globally-cached newer version and produce false drift).
    const prismaBin = resolve(PACKAGE_DIR, 'node_modules', '.bin', 'prisma');
    log.info({ tmpRoot, prismaBin }, 'Running `prisma generate` into tmp dir');
    execFileSync(prismaBin, ['generate', `--schema=${tmpSchemaDir}`], {
      cwd: PACKAGE_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    });

    const committed = buildManifest(COMMITTED_DIR);
    const fresh = buildManifest(tmpOutDir);

    if (committed.size === 0) {
      log.error({ COMMITTED_DIR }, 'Committed generated dir is empty');
      process.exit(1);
    }

    const diff = diffManifests(committed, fresh);
    const totalDrift = diff.onlyInCommitted.length + diff.onlyInFresh.length + diff.changed.length;

    if (totalDrift === 0) {
      log.info({ files: committed.size }, 'Committed Prisma client is in sync with schema.');
      return;
    }

    log.error(
      {
        added: diff.onlyInFresh.length,
        removed: diff.onlyInCommitted.length,
        changed: diff.changed.length,
      },
      'Prisma client drift detected — committed `generated/` is out of sync with `prisma/schema/`',
    );
    if (diff.onlyInFresh.length > 0) {
      log.error({ files: diff.onlyInFresh.slice(0, 10) }, 'Files only in fresh generate');
    }
    if (diff.onlyInCommitted.length > 0) {
      log.error(
        { files: diff.onlyInCommitted.slice(0, 10) },
        'Files only in committed dir (would be removed)',
      );
    }
    if (diff.changed.length > 0) {
      log.error({ files: diff.changed.slice(0, 10) }, 'Files with changed contents');
    }
    log.error('Run `pnpm --filter @contractor-ops/db run db:generate` and commit the result.');
    process.exit(1);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
