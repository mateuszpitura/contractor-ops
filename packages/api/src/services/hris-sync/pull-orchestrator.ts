// Inbound HRIS pull orchestrator — a clone of the directory-sync orchestrator.
//
// Per connection: open an IntegrationSyncLog(INBOUND), serialize with the `sync`
// advisory lock (a concurrent run skips), refresh an OAuth token when needed,
// list the provider's employees (delta via updated_since for Personio, full
// snapshot for BambooHR), and for each record project → hash → skip-if-unchanged
// → applyPatchToWorker. Writes ONLY the HRIS-owned allowlist (financial /
// compliance / national-ID columns are unreachable by the patch type), is
// per-record best-effort (one bad record never aborts the run), tenant-scoped
// (no cross-org write), and audited.

import type { DataRegion, Prisma } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import {
  decryptCredentials,
  encryptCredentials,
  getAdapter,
  loadHeavyAdapters,
} from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';

import { releaseAdvisoryLock, tryAcquireAdvisoryLock } from '../../lib/advisory-lock';
import { loadIntegrationConnection } from '../../lib/integration-connection';
import type { DbClient } from '../types';
import { applyPatchToWorker } from './apply-patch';
import { projectToWritablePatch } from './field-partition';
import { defaultMappingFor, readSyncState, resolveMapping, writeSyncState } from './mapping';
import { syncHash } from './sync-hash';
import type { HrisProvider } from './types';

const log = createLogger({ service: 'hris-pull-orchestrator' });

/** Hourly cadence — a connection synced within the last hour is skipped by the cron. */
const SYNC_THROTTLE_MS = 60 * 60 * 1000;

export type HrisPullStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface HrisPullResult {
  status: HrisPullStatus;
  applied: number;
  skipped: number;
  errors: number;
  reason?: string;
}

function providerSlug(provider: HrisProvider): 'personio' | 'bamboohr' {
  return provider === 'PERSONIO' ? 'personio' : 'bamboohr';
}

interface HrisAdapter {
  slug: string;
  supportsOAuth: boolean;
  listEmployees: (
    creds: ReturnType<typeof decryptCredentials>,
    opts: { updatedSince?: string },
  ) => Promise<
    Array<{
      externalId: string;
      provider: HrisProvider;
      attributes: Record<string, unknown>;
      updatedAt?: string;
    }>
  >;
  refreshToken?: (
    creds: ReturnType<typeof decryptCredentials>,
  ) => Promise<ReturnType<typeof decryptCredentials>>;
}

function isTokenExpired(expiresAt?: string): boolean {
  return Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now() + 5 * 60 * 1000);
}

/**
 * Run a single-connection HRIS pull. `db` is the tenant-scoped client (the
 * router passes `ctx.db`; the cron builds one per org) so every write is
 * org-isolated.
 */
export async function runHrisPull(params: {
  db: DbClient;
  organizationId: string;
  connectionId: string;
  actorUserId: string | null;
}): Promise<HrisPullResult> {
  const { db, organizationId, connectionId } = params;

  const syncLog = await db.integrationSyncLog.create({
    data: {
      organizationId,
      integrationConnectionId: connectionId,
      direction: 'INBOUND',
      syncType: 'hris_employee_sync',
      status: 'STARTED',
      startedAt: new Date(),
    },
  });

  const lockKey = `hris:${connectionId}`;
  if (!(await tryAcquireAdvisoryLock(prisma, 'sync', lockKey))) {
    await db.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        responsePayloadJson: { skipped: true, reason: 'already-running' },
      },
    });
    return { status: 'SKIPPED', applied: 0, skipped: 0, errors: 0, reason: 'already-running' };
  }

  try {
    const connection = await loadIntegrationConnection(db, connectionId, organizationId, {
      requireConnected: true,
    });
    const provider = connection.provider as HrisProvider;

    await loadHeavyAdapters();
    const adapter = getAdapter(providerSlug(provider)) as unknown as HrisAdapter;

    let creds = decryptCredentials(connection.credentialsRef, adapter.slug);
    if (adapter.supportsOAuth && adapter.refreshToken && isTokenExpired(creds.expiresAt)) {
      const refreshed = await adapter.refreshToken(creds);
      await db.integrationConnection.update({
        where: { id: connectionId },
        data: {
          credentialsRef: encryptCredentials(refreshed, adapter.slug),
          tokenExpiresAt: refreshed.expiresAt ? new Date(refreshed.expiresAt) : null,
        },
      });
      creds = refreshed;
    }

    const configured = resolveMapping(connection.configJson);
    const mapping =
      Object.keys(configured.standard).length > 0 ? configured : defaultMappingFor(provider);
    const priorState = readSyncState(connection.configJson);

    const remote = await adapter.listEmployees(creds, {
      updatedSince: priorState.lastSuccessfulSyncAt,
    });

    const nextHashes: Record<string, string> = { ...(priorState.hashes ?? {}) };
    let applied = 0;
    let skipped = 0;
    let errors = 0;
    let latestCursorAt = priorState.lastSuccessfulSyncAt;

    for (const record of remote) {
      const patch = projectToWritablePatch(record, mapping);
      const hash = syncHash(patch);
      if (priorState.hashes?.[record.externalId] === hash) {
        skipped += 1;
        continue;
      }
      try {
        const result = await applyPatchToWorker(db, organizationId, record.externalId, patch, {
          origin: 'HRIS_PULL',
          integrationConnectionId: connectionId,
        });
        if (result && result.applied === false) {
          skipped += 1;
        } else {
          applied += 1;
          // Record the hash only when the patch actually applied so an unlinked
          // record is re-attempted after linking instead of being skipped forever.
          nextHashes[record.externalId] = hash;
          if (record.updatedAt) {
            if (!latestCursorAt || record.updatedAt > latestCursorAt) {
              latestCursorAt = record.updatedAt;
            }
          } else {
            const attrUpdated = record.attributes?.updated_at;
            if (typeof attrUpdated === 'string') {
              if (!latestCursorAt || attrUpdated > latestCursorAt) {
                latestCursorAt = attrUpdated;
              }
            }
          }
        }
      } catch (err) {
        errors += 1;
        log.warn(
          { err, organizationId, connectionId, externalId: record.externalId },
          'hris pull: record failed (best-effort, continuing)',
        );
      }
    }

    const syncSucceeded = errors === 0;
    const now = new Date();
    const nextConfig = writeSyncState(connection.configJson, {
      ...(syncSucceeded && latestCursorAt
        ? { lastSuccessfulSyncAt: latestCursorAt }
        : syncSucceeded
          ? { lastSuccessfulSyncAt: now.toISOString() }
          : {}),
      hashes: nextHashes,
    });
    await db.integrationConnection.update({
      where: { id: connectionId },
      data: {
        configJson: nextConfig as Prisma.InputJsonValue,
        lastSyncAt: now,
        ...(syncSucceeded ? { lastSuccessAt: now } : {}),
      },
    });
    await db.integrationSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: syncSucceeded ? 'SUCCESS' : 'FAILED',
        completedAt: now,
        errorMessage: syncSucceeded ? null : `${errors} record(s) failed during pull`,
        responsePayloadJson: { applied, skipped, errors },
      },
    });

    return {
      status: syncSucceeded ? 'SUCCESS' : 'FAILED',
      applied,
      skipped,
      errors,
    } as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.integrationSyncLog
      .update({
        where: { id: syncLog.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: message.slice(0, 1000) },
      })
      // safe-swallow: best-effort failure bookkeeping — the original sync error rethrows below
      .catch(() => undefined);
    await db.integrationConnection
      .update({
        where: { id: connectionId },
        data: { lastErrorAt: new Date(), lastErrorMessage: message.slice(0, 1000) },
      })
      // safe-swallow: best-effort failure bookkeeping — the original sync error rethrows below
      .catch(() => undefined);
    throw err;
  } finally {
    // safe-swallow: advisory lock dies with the session anyway; a release failure must not mask the sync result
    await releaseAdvisoryLock(prisma, 'sync', lockKey).catch(() => undefined);
  }
}

export interface ScheduledHrisSyncResult {
  evaluated: number;
  ran: number;
  skipped: number;
  runs: Array<{
    organizationId: string;
    connectionId: string;
    provider: HrisProvider;
    result: HrisPullResult | { error: string };
  }>;
}

/**
 * Cron fan-out: iterate every CONNECTED HRIS connection, throttle by
 * `lastSyncAt` (hourly), and run `runHrisPull` inside `tenantStore.run` on the
 * connection's regional tenant client so org isolation is preserved.
 */
export async function runScheduledHrisSync(deps: {
  prisma: import('@contractor-ops/db').PrismaClient;
  getRegionalClient: (region: DataRegion) => unknown;
  createTenantClientFrom: (p: unknown) => DbClient;
  tenantStore: { run<R>(ctx: { organizationId: string; region: string }, cb: () => R): R };
}): Promise<ScheduledHrisSyncResult> {
  const cutoff = new Date(Date.now() - SYNC_THROTTLE_MS);
  const summary: ScheduledHrisSyncResult = { evaluated: 0, ran: 0, skipped: 0, runs: [] };

  const connections = await deps.prisma.integrationConnection.findMany({
    where: { status: 'CONNECTED', provider: { in: ['PERSONIO', 'BAMBOOHR'] } },
    select: {
      id: true,
      organizationId: true,
      provider: true,
      lastSyncAt: true,
      organization: { select: { dataRegion: true } },
    },
  });
  summary.evaluated = connections.length;

  for (const c of connections) {
    if (c.lastSyncAt && c.lastSyncAt > cutoff) {
      summary.skipped += 1;
      continue;
    }
    const region: DataRegion = c.organization.dataRegion ?? 'EU';
    const tenantDb = deps.createTenantClientFrom(deps.getRegionalClient(region));
    const provider = c.provider as HrisProvider;
    try {
      const result = await deps.tenantStore.run({ organizationId: c.organizationId, region }, () =>
        runHrisPull({
          db: tenantDb,
          organizationId: c.organizationId,
          connectionId: c.id,
          actorUserId: null,
        }),
      );
      summary.ran += 1;
      summary.runs.push({ organizationId: c.organizationId, connectionId: c.id, provider, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.runs.push({
        organizationId: c.organizationId,
        connectionId: c.id,
        provider,
        result: { error: message },
      });
      log.error(
        { err, organizationId: c.organizationId, connectionId: c.id },
        'hris-sync cron: connection failed',
      );
    }
  }

  log.info(
    { evaluated: summary.evaluated, ran: summary.ran, skipped: summary.skipped },
    'hris-sync cron completed',
  );
  return summary;
}
