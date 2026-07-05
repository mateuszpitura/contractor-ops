// HRIS provider wire contracts — the boundary shapes the Personio + BambooHR
// adapters produce/consume. These live in the integrations layer (not the api
// package) because the api package depends on integrations, never the reverse;
// `@contractor-ops/api`'s hris-sync types.ts re-exports them.

/** The two HRIS providers this engine supports. One HRIS per org (DB-enforced). */
export const HRIS_PROVIDERS = ['PERSONIO', 'BAMBOOHR'] as const;
export type HrisProvider = (typeof HRIS_PROVIDERS)[number];

/**
 * A normalized raw provider record. The adapter flattens the provider's native
 * shape into a stable `externalId` + an untyped `attributes` bag keyed by the
 * provider's attribute name. `attributes` is `Record<string, unknown>` because
 * attribute-scoped credentials (Personio) silently omit unpermitted fields —
 * absence is normal, never an error.
 */
export interface HrisEmployeeRecord {
  externalId: string;
  provider: HrisProvider;
  attributes: Record<string, unknown>;
  /** Provider's own last-modified marker, when present (drives delta/snapshot-diff). */
  updatedAt?: string;
}

/**
 * The three CO-owned business events the push carries out to the HRIS. Each
 * carries `workerId` + the business id and minimal denormalized fields — never
 * an HRIS-owned registry key (the disjoint partition is the loop-break).
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

/**
 * What the push handler hands the adapter: the business event plus the resolved
 * HRIS `externalId` for the target person (the handler joins CO `workerId` →
 * `externalId` via ExternalLink before dispatch).
 */
export type HrisPushInput = HrisPushPayload & { externalId?: string };
