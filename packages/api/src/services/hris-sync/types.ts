// Shared, I/O-free contracts for the HRIS two-way sync engine.
//
// These are wire/DTO types only — no Prisma imports. The adapters (Personio,
// BambooHR) normalize their provider payloads into `HrisEmployeeRecord`; the
// pull orchestrator projects a record through the field-partition allowlist
// into an `HrisWritableEmployeePatch`; the push handlers carry an
// `HrisPushPayload` (a CO-owned business event) out to the connected HRIS.

/** The two HRIS providers this engine supports. One HRIS per org (DB-enforced). */
export const HRIS_PROVIDERS = ['PERSONIO', 'BAMBOOHR'] as const;
export type HrisProvider = (typeof HRIS_PROVIDERS)[number];

/**
 * A normalized raw provider record. The adapter flattens the provider's native
 * shape into a stable `externalId` + an untyped `attributes` bag keyed by the
 * provider's attribute name; the field-partition projection resolves those
 * attribute keys to the writable allowlist via the org's `HrisFieldMapping`.
 *
 * `attributes` is deliberately `Record<string, unknown>` — attribute-scoped
 * Personio credentials silently omit unpermitted fields, so any given key may
 * be absent. Absence is normal, never an error.
 */
export interface HrisEmployeeRecord {
  externalId: string;
  provider: HrisProvider;
  attributes: Record<string, unknown>;
  /** Provider's own last-modified marker, when present (drives delta/snapshot-diff). */
  updatedAt?: string;
}

/**
 * The org's field mapping, persisted in `IntegrationConnection.configJson`.
 * `standard` maps each writable target key to the HRIS attribute name that
 * feeds it; `customAttributes` maps an HRIS custom-attribute key to a
 * `countryFields` key (BambooHR custom-attr path is contract-gated).
 */
export interface HrisFieldMapping {
  standard: {
    displayName?: string;
    email?: string;
    position?: string;
    department?: string;
    employmentStatus?: string;
    hireDate?: string;
    terminatedAt?: string;
  };
  customAttributes?: Record<string, string>;
}

/**
 * Snapshot-diff state, persisted alongside the mapping in `configJson`. The
 * pull reads `lastSuccessfulSyncAt` as its delta cursor (Personio) and diffs
 * each record's `syncHash` against `hashes` (BambooHR un-paginated snapshot).
 */
export interface HrisSyncState {
  lastSuccessfulSyncAt?: string;
  hashes?: Record<string, string>;
}

/**
 * The three CO-owned business events the push carries out to the HRIS. Each
 * carries `workerId` plus the business id and minimal denormalized fields. By
 * construction these contain NO HRIS-owned registry key — the disjoint
 * partition is what breaks the write-back loop; `assertNotHrisOwnedField`
 * enforces it as defense-in-depth.
 */
export type HrisPushPayload =
  | {
      kind: 'invoice-paid';
      workerId: string;
      invoiceId: string;
      paidAt: string;
      amount: string;
      currency: string;
      idempotencyKey?: string;
    }
  | {
      kind: 'payment-status';
      workerId: string;
      paymentId: string;
      status: string;
      occurredAt: string;
      idempotencyKey?: string;
    }
  | {
      kind: 'classification-outcome';
      workerId: string;
      classificationId: string;
      outcome: string;
      decidedAt: string;
      idempotencyKey?: string;
    };
