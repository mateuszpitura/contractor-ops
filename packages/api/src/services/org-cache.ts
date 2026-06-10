// ---------------------------------------------------------------------------
// Cross-region tenant cache for Organization meta.
// ---------------------------------------------------------------------------
//
// Problem: every authenticated tRPC request issues
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

import type { DataRegion } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { cached, cacheKey, invalidate } from './cache';

const log = createLogger({ service: 'org-cache' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrgMeta {
  id: string;
  dataRegion: DataRegion;
  status: string;
  name: string;
  /**
   * Phase C.7.b — added so dashboard + portal layout reads (which run on
   * every navigation) can serve from cache instead of issuing per-request
   * `findUnique` round-trips. Still org-meta (no credentials, no settings
   * JSON), still invalidated by the existing `organization.update`/`delete`
   * Prisma extension in `packages/api/src/middleware/tenant.ts`.
   */
  slug: string;
  logo: string | null;
  countryCode: string | null;
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
      select: {
        id: true,
        dataRegion: true,
        status: true,
        name: true,
        slug: true,
        logo: true,
        countryCode: true,
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      dataRegion: row.dataRegion,
      status: row.status,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      countryCode: row.countryCode,
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

// ---------------------------------------------------------------------------
// Branding — separate cache row for portal-shell branding so the
// hot getOrgMeta envelope stays small and free of settingsJson leakage. Read
// on every portal navigation; invalidated by the same Prisma extension that
// drops getOrgMeta and by the updateBranding mutation handler.
// ---------------------------------------------------------------------------

export interface OrgBranding {
  id: string;
  name: string;
  logo: string | null;
  /** Validated brand color (hex `#RRGGBB`/`#RGB` or `hsl(...)`), or null. */
  brandColor: string | null;
}

/** TTL for the cached org-branding envelope (5 minutes). */
export const ORG_BRANDING_TTL_SECONDS = 5 * 60;

export function orgBrandingKey(orgId: string): string {
  return cacheKey('org', orgId, 'branding');
}

/**
 * Strict parser for org-supplied brand color. Accepts:
 *   - `#RRGGBB` / `#RGB` hex
 *   - `hsl(H, S%, L%)` / `hsl(H S% L%)` (also `hsla(...)`)
 * Any other shape (including raw `rgb()`, named colors, unparseable HSL)
 * → `null`. Defense in depth — DB validation only enforces `#RRGGBB`, but
 * legacy settings rows may contain looser values and consumers should never
 * inject unvalidated strings into a CSS variable.
 */
export function parseBrandColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Hex: #RGB or #RRGGBB
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // hsl()/hsla() with comma- or space-separated args
  const hslMatch = trimmed
    .toLowerCase()
    .match(
      /^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%\s*(?:[,/]\s*(\d+(?:\.\d+)?%?)\s*)?\)$/,
    );
  if (hslMatch) {
    const h = Number(hslMatch[1]);
    const s = Number(hslMatch[2]);
    const l = Number(hslMatch[3]);
    const alphaRaw = hslMatch[4];
    if (
      !(
        Number.isFinite(h) &&
        Number.isFinite(s) &&
        Number.isFinite(l) &&
        s >= 0 &&
        s <= 100 &&
        l >= 0 &&
        l <= 100
      )
    ) {
      return null;
    }
    if (alphaRaw !== undefined) {
      // Alpha may be a unit-less number in [0, 1] or a percentage in [0, 100].
      // Browsers tolerate out-of-range alpha by clamping, but the parser is
      // the boundary of trust for the inline --primary CSS variable, so
      // reject anything we wouldn't write ourselves.
      const isPercent = alphaRaw.endsWith('%');
      const alpha = Number(isPercent ? alphaRaw.slice(0, -1) : alphaRaw);
      if (!Number.isFinite(alpha)) return null;
      if (isPercent) {
        if (alpha < 0 || alpha > 100) return null;
      } else if (alpha < 0 || alpha > 1) {
        return null;
      }
    }
    return trimmed;
  }

  return null;
}

/**
 * Returns the cached portal branding for `orgId`. Hot path on every portal
 * navigation; uses its own cache key so the broad `getOrgMeta` envelope stays
 * free of settingsJson. Returns `null` only when the org doesn't exist.
 */
export async function getOrgBranding(orgId: string): Promise<OrgBranding | null> {
  if (!orgId) return null;

  return await cached(orgBrandingKey(orgId), ORG_BRANDING_TTL_SECONDS, async () => {
    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, logo: true, settingsJson: true },
    });

    if (!row) return null;

    const settings = (row.settingsJson as Record<string, unknown> | null) ?? {};
    return {
      id: row.id,
      name: row.name,
      logo: row.logo,
      brandColor: parseBrandColor(settings.brandColor),
    } satisfies OrgBranding;
  });
}

/** Invalidate the cached branding envelope for one org. */
export async function invalidateOrgBranding(orgId: string): Promise<void> {
  if (!orgId) return;
  try {
    await invalidate(orgBrandingKey(orgId));
  } catch (err) {
    log.warn({ err, orgId }, 'invalidateOrgBranding failed');
  }
}
