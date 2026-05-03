// ---------------------------------------------------------------------------
// Phase 2 P2-C — F-DB-03 — Cross-region tenant cache for Organization meta.
// ---------------------------------------------------------------------------
//
// Problem (audit F-DB-03): every authenticated tRPC request issues
// `prisma.organization.findUnique({ where: { id: orgId }, select: { ... } })`
// against the EU primary to discover the tenant's data region. For ME-region
// tenants this is a cross-region RTT (80–200ms) on the hot path. At 50 RPS per
// pod that's 50 needless reads per second hammering a tiny but very hot table.
//
// Fix: read-through Upstash Redis cache keyed by `org:${id}:meta` with a
// 5-minute TTL holding only the fields the tenant middleware needs
// (id, dataRegion, status, name). Invalidated by the Prisma `organization`
// update/delete extension installed alongside the existing tenant scope.
//
// Security contract:
//   - Only non-sensitive metadata is cached (name, dataRegion, status). No
//     credentials, no tax IDs, no settings JSON.
//   - Cache writes are fire-and-forget — a Redis outage degrades to a direct
//     DB read but never blocks the request.
//   - Org `update`/`delete` invalidates the key immediately so a region change
//     (rare) propagates within one request after the mutation.
//
// Pino logger only — no console.* (CLAUDE.md).

import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { cached, cacheKey, invalidate } from './cache.js';

const log = createLogger({ service: 'org-cache' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgMeta {
  id: string;
  dataRegion: string;
  status: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TTL for the cached organization meta envelope (5 minutes per audit decision). */
export const ORG_META_TTL_SECONDS = 5 * 60;

/** Cache-key builder for the per-org meta envelope. */
export function orgMetaKey(orgId: string): string {
  return cacheKey('org', orgId, 'meta');
}

// ---------------------------------------------------------------------------
// Read-through accessor
// ---------------------------------------------------------------------------

/**
 * Returns the cached organization meta for `orgId`, falling back to a single
 * Prisma `findUnique` against the EU primary on cache miss. Returns `null`
 * when the organization does not exist (NOT cached — let callers handle
 * NOT_FOUND uniformly without a stale negative entry).
 */
export async function getOrgMeta(orgId: string): Promise<OrgMeta | null> {
  if (!orgId) return null;

  return await cached(orgMetaKey(orgId), ORG_META_TTL_SECONDS, async () => {
    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, dataRegion: true, status: true, name: true },
    });

    if (!row) return null;

    return {
      id: row.id,
      dataRegion: row.dataRegion,
      status: row.status,
      name: row.name,
    } satisfies OrgMeta;
  });
}

// ---------------------------------------------------------------------------
// Invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidate the cached meta envelope for one org. Called by the Prisma
 * `organization` extension on update/delete and by any explicit admin action
 * that mutates the row outside of Prisma (none today, but keep the helper
 * exposed for parity).
 */
export async function invalidateOrgMeta(orgId: string): Promise<void> {
  if (!orgId) return;
  try {
    await invalidate(orgMetaKey(orgId));
  } catch (err) {
    log.warn({ err, orgId }, 'invalidateOrgMeta failed');
  }
}
