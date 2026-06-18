#!/usr/bin/env tsx
/**
 * Phase 70 D-14 — Backfill IntegrationConnection.scopeCapabilities for
 * existing GOOGLE_WORKSPACE connections.
 *
 * Idempotent: WHERE scopeCapabilities IS NULL AND provider = 'GOOGLE_WORKSPACE'.
 * Per-region: invoke once per regional database URL (DATABASE_URL_EU, DATABASE_URL_ME).
 *
 * Usage:
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts
 *   DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts
 *
 *   # Dry-run (no writes):
 *   DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBaseLoggerOptions } from '@contractor-ops/logger';
import { config } from 'dotenv';
import pino from 'pino';
import type { ScopeCapabilities } from '../src/types/scope-capabilities.js';

// F-OBS-12 — share baseOptions with the rest of the app (PII redact + ISO time).
const log = pino({ ...getBaseLoggerOptions(), name: 'backfill-scope-capabilities' });

// biome-ignore lint/style/useNamingConvention: standard Node.js __dirname polyfill for ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../..');
config({ path: resolve(ROOT_DIR, '.env') });

// Match exactly the scopes in packages/integrations/src/adapters/google-workspace-adapter.ts
// (lines 57-58 at time of writing). T-70-09-01 mitigation: tests assert this verbatim.
const GOOGLE_WORKSPACE_V3_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
] as const;

const PROVIDER_BACKFILL: Record<string, ScopeCapabilities | undefined> = {
  GOOGLE_WORKSPACE: {
    provider: 'google',
    scopes: [...GOOGLE_WORKSPACE_V3_SCOPES],
    capabilities: ['directory.read', 'group.read'],
    grantedAt: new Date('2026-04-26T00:00:00.000Z').toISOString(),
  },
  // Other providers: no baseline backfill — they get scopeCapabilities populated
  // when their next OAuth callback runs (Phase 76+).
};

export interface ConnectionRow {
  id: string;
  provider: string;
  scopeCapabilities: unknown | null;
}

export interface BackfillUpdate {
  connectionId: string;
  scopeCapabilities: ScopeCapabilities;
}

export interface BackfillOptions {
  connections: readonly ConnectionRow[];
  dryRun?: boolean;
}

export function backfillScopeCapabilities(opts: BackfillOptions): Promise<BackfillUpdate[]> {
  const updates: BackfillUpdate[] = [];
  for (const c of opts.connections) {
    if (c.scopeCapabilities !== null) continue;
    const baseline = PROVIDER_BACKFILL[c.provider];
    if (!baseline) continue;
    updates.push({ connectionId: c.id, scopeCapabilities: baseline });
  }
  return Promise.resolve(updates);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log.error('DATABASE_URL is not set — refusing to run');
    process.exit(2);
  }

  log.info({ dbUrl: dbUrl.replace(/:[^:@/]+@/, ':***@'), dryRun }, 'connecting');

  // Lazy-import so the pure `backfillScopeCapabilities` export stays testable
  // without dragging the Prisma runtime into vitest's module graph.
  const { Prisma, PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const candidates = await prisma.integrationConnection.findMany({
      // `Json?` columns distinguish JSON `null` from SQL NULL; `Prisma.DbNull`
      // matches rows where scopeCapabilities was never written.
      where: { scopeCapabilities: { equals: Prisma.DbNull } },
      select: { id: true, provider: true, scopeCapabilities: true },
    });
    log.info({ count: candidates.length }, 'candidates with null scopeCapabilities');

    const updates = await backfillScopeCapabilities({
      connections: candidates.map(c => ({
        id: c.id,
        provider: c.provider,
        scopeCapabilities: c.scopeCapabilities,
      })),
    });
    log.info({ count: updates.length }, 'updates planned');

    if (dryRun) {
      log.info('dry-run — no writes');
      return;
    }

    await prisma.$transaction(
      updates.map(u =>
        prisma.integrationConnection.update({
          where: { id: u.connectionId },
          data: { scopeCapabilities: u.scopeCapabilities as object },
        }),
      ),
    );
    log.info({ count: updates.length }, 'backfill applied');
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    log.error({ err }, 'backfill failed');
    process.exit(1);
  });
}
