// packages/api/src/services/peppol-capability.ts
//
// Phase 61 · Plan 61-05 · EINV-06 — Peppol SMP capability lookup service +
// 6h TTL cache + send-gate / pre-flight helpers consumed by Plan 06's
// `einvoice.send` mutation and the `peppol.lookupCapabilities` tRPC query.
//
// Architecture (per CONTEXT D-11 + RESEARCH §Collision Option A):
//
//   ┌──────────────────────┐      ┌────────────────────────────┐
//   │ tRPC router / send   │─────▶│ getCapabilitiesWithCache() │
//   │ mutation / Plan 06   │      └─────────────┬──────────────┘
//   └──────────────────────┘                    │
//                                     cache hit?│
//                                    ┌──────────┴──────────┐
//                                    ▼                     ▼
//                         PeppolCapabilityCache      Storecove adapter
//                         (6h TTL, per-org)           /discovery/receives
//
// Boundaries:
// - Every read + write is scoped by `organizationId`. Cross-tenant leakage
//   is structurally impossible at this layer (unique index
//   (organizationId, schemeId, value) enforces it; the query filters
//   mirror the same key).
// - Pure helpers — callers supply the tenant-scoped Prisma client and an
//   ASPAdapter instance.  No module-level state.
// - All errors that must reach Plan 07's UI carry the literal error codes
//   `PEPPOL_PARTICIPANT_NOT_ACTIVE` and `PARTICIPANT_NOT_REACHABLE` so the
//   i18n surface Plan 07 owns maps 1:1 without parsing message text.

import type { ASPAdapter, ParticipantCapabilityResult } from '@contractor-ops/einvoice';
import { STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID } from '@contractor-ops/einvoice';

// ---------------------------------------------------------------------------
// Public error codes (consumed verbatim by Plan 07 i18n)
// ---------------------------------------------------------------------------

export const PEPPOL_PARTICIPANT_NOT_ACTIVE = 'PEPPOL_PARTICIPANT_NOT_ACTIVE' as const;
export const PARTICIPANT_NOT_REACHABLE = 'PARTICIPANT_NOT_REACHABLE' as const;

// ---------------------------------------------------------------------------
// TTL — 6h per CONTEXT D-11
// ---------------------------------------------------------------------------

/**
 * Default lifetime for a cached capability lookup. CONTEXT D-11 pinned 6h
 * as a safe default weighing freshness (Storecove SMP participants very
 * rarely change doc-type registrations) against Storecove's per-org rate
 * budget. Callers can override via `opts.ttlMs` for tests or a force-soon
 * refresh path — production code paths always use the default.
 */
export const CAPABILITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 21_600_000

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CapabilityResult extends ParticipantCapabilityResult {
  /** True when the row was served from `PeppolCapabilityCache` without hitting Storecove. */
  fromCache: boolean;
  /** Current cache row's `expiresAt` after this call. */
  expiresAt: Date;
}

export interface GetCapabilitiesOptions {
  /** Override the 6h default. Primarily for tests. */
  ttlMs?: number;
  /** Skip the cache READ; still writes the fresh row back. */
  forceRefresh?: boolean;
}

// Minimal database surface the service uses — allows in-memory test doubles
// to stand in for `PrismaClient` without requiring a live DB.
interface PeppolCapabilityDb {
  peppolCapabilityCache: {
    findUnique: (args: {
      where: {
        organizationId_schemeId_value: {
          organizationId: string;
          schemeId: string;
          value: string;
        };
      };
    }) => Promise<{
      id: string;
      organizationId: string;
      schemeId: string;
      value: string;
      documentTypes: unknown; // Prisma Json column
      cachedAt: Date;
      expiresAt: Date;
    } | null>;
    upsert: (args: {
      where: {
        organizationId_schemeId_value: {
          organizationId: string;
          schemeId: string;
          value: string;
        };
      };
      create: {
        organizationId: string;
        schemeId: string;
        value: string;
        documentTypes: unknown;
        expiresAt: Date;
      };
      update: {
        documentTypes: unknown;
        cachedAt: Date;
        expiresAt: Date;
      };
    }) => Promise<unknown>;
  };
  peppolParticipant: {
    findFirst: (args: {
      where: { organizationId: string; status?: string | { in: string[] } };
    }) => Promise<{ id: string; status: string } | null>;
  };
}

// ---------------------------------------------------------------------------
// getCapabilitiesWithCache
// ---------------------------------------------------------------------------

/**
 * Resolve a participant's Peppol document-type capabilities, preferring the
 * cached result when `expiresAt > now`. Writes / refreshes the cache row on
 * every adapter round-trip.
 *
 * Never throws on a cache-miss: an ASP 404 (participant not registered on
 * the SML) propagates as `documentTypes: []` — callers interpret empty as
 * `PARTICIPANT_NOT_REACHABLE` via `assertReceiverAcceptsXRechnung`.
 */
export async function getCapabilitiesWithCache(
  db: PeppolCapabilityDb,
  adapter: Pick<ASPAdapter, 'lookupParticipantCapabilities'>,
  organizationId: string,
  schemeId: string,
  value: string,
  opts: GetCapabilitiesOptions = {},
): Promise<CapabilityResult> {
  const ttlMs = opts.ttlMs ?? CAPABILITY_CACHE_TTL_MS;
  const forceRefresh = opts.forceRefresh ?? false;
  const now = new Date();

  // 1) Cache read — skipped entirely when forceRefresh.
  if (!forceRefresh) {
    const cached = await db.peppolCapabilityCache.findUnique({
      where: {
        organizationId_schemeId_value: { organizationId, schemeId, value },
      },
    });
    if (cached && cached.expiresAt.getTime() > now.getTime()) {
      return {
        schemeId: cached.schemeId,
        value: cached.value,
        documentTypes: normaliseDocumentTypes(cached.documentTypes),
        fetchedAt: cached.cachedAt,
        expiresAt: cached.expiresAt,
        fromCache: true,
      };
    }
  }

  // 2) Fresh lookup — adapter owns its own rate-limit + audit log.
  const fresh = await adapter.lookupParticipantCapabilities({
    schemeId,
    value,
    organizationId,
  });

  const expiresAt = new Date(now.getTime() + ttlMs);
  await db.peppolCapabilityCache.upsert({
    where: {
      organizationId_schemeId_value: { organizationId, schemeId, value },
    },
    create: {
      organizationId,
      schemeId,
      value,
      documentTypes: fresh.documentTypes,
      expiresAt,
    },
    update: {
      documentTypes: fresh.documentTypes,
      cachedAt: now,
      expiresAt,
    },
  });

  return {
    schemeId: fresh.schemeId,
    value: fresh.value,
    documentTypes: fresh.documentTypes,
    fetchedAt: fresh.fetchedAt,
    expiresAt,
    fromCache: false,
  };
}

/**
 * `documentTypes` is a Prisma `Json` column — narrow the runtime value to a
 * `string[]` defensively. An invalid cached shape (should never happen given
 * we own the write path) is treated as an empty list so callers still make
 * the correct pre-flight decision.
 */
function normaliseDocumentTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

// ---------------------------------------------------------------------------
// supportsXRechnungCii — pure predicate
// ---------------------------------------------------------------------------

/**
 * True iff the participant advertises the XRechnung-CII doc-type ID
 * (pending Plan 05 sandbox-confirmation of the literal; see
 * `STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID` in `@contractor-ops/einvoice`).
 *
 * Intentionally synchronous — the heavy lifting (cache + adapter) happens
 * upstream in `getCapabilitiesWithCache`.
 */
export function supportsXRechnungCii(documentTypes: string[]): boolean {
  return documentTypes.includes(STORECOVE_CII_XRECHNUNG_DOC_TYPE_ID);
}

// ---------------------------------------------------------------------------
// Send-gate — sender participant must be ACTIVE
// ---------------------------------------------------------------------------

/**
 * Throws `PEPPOL_PARTICIPANT_NOT_ACTIVE` when the org has no `ACTIVE`
 * PeppolParticipant. Plan 06 `einvoice.send` invokes this BEFORE any
 * HTTP request so non-active orgs never hit Storecove's billing meter.
 *
 * "ACTIVE" is defined by `PeppolParticipantStatus.ACTIVE` (see
 * `packages/db/prisma/schema/peppol.prisma`). `PENDING` / `REGISTERED` /
 * `SUSPENDED` / `DEREGISTERED` all fail the gate.
 */
export async function assertSenderParticipantActive(
  db: PeppolCapabilityDb,
  organizationId: string,
): Promise<void> {
  const participant = await db.peppolParticipant.findFirst({
    where: { organizationId, status: 'ACTIVE' },
  });
  if (!participant) {
    throw new Error(PEPPOL_PARTICIPANT_NOT_ACTIVE);
  }
}

// ---------------------------------------------------------------------------
// Pre-flight — receiver must accept XRechnung-CII
// ---------------------------------------------------------------------------

/**
 * Throws `PARTICIPANT_NOT_REACHABLE` when the recipient's Peppol SML entry
 * does not advertise the XRechnung-CII doc-type ID. Runs through the cache
 * (`getCapabilitiesWithCache`) so repeat sends to the same buyer stay under
 * Storecove's per-org rate budget.
 *
 * Plan 06 `einvoice.send` invokes this AFTER `assertSenderParticipantActive`
 * to avoid misleading the user with a "receiver not reachable" toast when
 * the actual blocker is the sender's own participant state.
 */
export async function assertReceiverAcceptsXRechnung(
  db: PeppolCapabilityDb,
  adapter: Pick<ASPAdapter, 'lookupParticipantCapabilities'>,
  organizationId: string,
  schemeId: string,
  value: string,
): Promise<void> {
  const result = await getCapabilitiesWithCache(db, adapter, organizationId, schemeId, value);
  if (!supportsXRechnungCii(result.documentTypes)) {
    throw new Error(PARTICIPANT_NOT_REACHABLE);
  }
}
