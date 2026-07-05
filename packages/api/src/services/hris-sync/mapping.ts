// HRIS connection config: the field mapping + snapshot-diff sync-state that live
// in `IntegrationConnection.configJson`, plus the credential-safe public
// projection and the one-HRIS-per-org constraint-recognition helper.
//
// Storage precedent: the Teams channel-mapping router keeps its mapping in
// `configJson` and projects a public subset for non-admins. HRIS mirrors that —
// the raw blob additionally holds the sync-state (last cursor + per-record
// hashes) which must never leak, so `publicHrisConfig` exposes only the mapping.

import { z } from 'zod';

import type { HrisFieldMapping, HrisProvider, HrisSyncState } from './types';

// ---------------------------------------------------------------------------
// Field-mapping schema (.strict)
// ---------------------------------------------------------------------------

/**
 * The org's HRIS field mapping. `standard` maps each writable target key to the
 * HRIS attribute name that feeds it; `customAttributes` maps an HRIS
 * custom-attribute key to a `countryFields` key. `.strict()` rejects any
 * unknown top-level key so a typo or an injected field fails closed.
 */
export const hrisFieldMappingSchema = z
  .object({
    standard: z
      .object({
        displayName: z.string().optional(),
        email: z.string().optional(),
        position: z.string().optional(),
        department: z.string().optional(),
        employmentStatus: z.string().optional(),
        hireDate: z.string().optional(),
        terminatedAt: z.string().optional(),
      })
      .strict(),
    customAttributes: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type HrisFieldMappingInput = z.infer<typeof hrisFieldMappingSchema>;

const EMPTY_MAPPING: HrisFieldMapping = { standard: {} };

/**
 * Conventional default attribute names per provider, used when an org has not
 * configured a mapping yet so the first pull still populates registry fields.
 */
export function defaultMappingFor(provider: HrisProvider): HrisFieldMapping {
  if (provider === 'PERSONIO') {
    return {
      standard: {
        displayName: 'name',
        email: 'email',
        position: 'position',
        department: 'department',
        employmentStatus: 'status',
        hireDate: 'hire_date',
        terminatedAt: 'termination_date',
      },
    };
  }
  return {
    standard: {
      displayName: 'displayName',
      email: 'workEmail',
      position: 'jobTitle',
      department: 'department',
      employmentStatus: 'status',
      hireDate: 'hireDate',
      terminatedAt: 'terminationDate',
    },
  };
}

interface HrisConnectionConfig {
  mapping?: unknown;
  syncState?: unknown;
  [key: string]: unknown;
}

function asConfigObject(configJson: unknown): HrisConnectionConfig {
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) return {};
  return configJson as HrisConnectionConfig;
}

/**
 * Safe-parse the org's field mapping out of `configJson`. Returns the parsed
 * mapping, or an empty `{ standard: {} }` when absent/invalid — never throws, so
 * a malformed blob degrades to "no mapping configured" rather than aborting a
 * sync. The caller merges a provider default when the standard map is empty.
 */
export function resolveMapping(configJson: unknown): HrisFieldMapping {
  const parsed = hrisFieldMappingSchema.safeParse(asConfigObject(configJson).mapping);
  return parsed.success ? parsed.data : EMPTY_MAPPING;
}

// ---------------------------------------------------------------------------
// Snapshot-diff sync-state
// ---------------------------------------------------------------------------

const syncStateSchema = z
  .object({
    lastSuccessfulSyncAt: z.string().optional(),
    hashes: z.record(z.string(), z.string()).optional(),
  })
  .strict();

/** Read the snapshot-diff state (delta cursor + per-record hashes) from configJson. */
export function readSyncState(configJson: unknown): HrisSyncState {
  const parsed = syncStateSchema.safeParse(asConfigObject(configJson).syncState);
  return parsed.success ? parsed.data : {};
}

/**
 * Merge a sync-state patch back into the configJson blob, preserving the mapping
 * and any other keys. Returns the new blob to persist on the connection row.
 */
export function writeSyncState(configJson: unknown, patch: HrisSyncState): Record<string, unknown> {
  const config = asConfigObject(configJson);
  const prior = readSyncState(configJson);
  return {
    ...config,
    syncState: {
      ...prior,
      ...patch,
      ...(patch.hashes ? { hashes: patch.hashes } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Public projection (credential-safe)
// ---------------------------------------------------------------------------

/**
 * Project a connection's `configJson` down to the fields safe to expose to a
 * settings reader: the field mapping only. Never exposes `credentialsRef` (not
 * in configJson anyway) or the raw sync-state (delta cursor + record hashes).
 */
export function publicHrisConfig(configJson: unknown): { mapping: HrisFieldMapping } {
  return { mapping: resolveMapping(configJson) };
}

// ---------------------------------------------------------------------------
// One-HRIS-per-org constraint recognition
// ---------------------------------------------------------------------------

/** The partial unique index name authored in the HRIS two-way sync migration. */
export const ONE_HRIS_PER_ORG_INDEX = 'integration_connection_one_hris_per_org';

/**
 * Recognize a Prisma P2002 raised by the one-HRIS-per-org partial unique index
 * so the connect procedure can map it to a typed CONFLICT ("another HRIS is
 * already connected"). Duck-typed on `code` + `meta.target` so it works whether
 * the caller passes a `PrismaClientKnownRequestError` or a plain error shape.
 */
export function isOneHrisPerOrgViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { code?: unknown; meta?: unknown };
  if (candidate.code !== 'P2002') return false;
  const target = (candidate.meta as { target?: unknown } | undefined)?.target;
  if (typeof target === 'string') return target.includes(ONE_HRIS_PER_ORG_INDEX);
  if (Array.isArray(target)) return target.some(t => String(t).includes(ONE_HRIS_PER_ORG_INDEX));
  return false;
}
