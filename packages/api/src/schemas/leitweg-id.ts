// tRPC input schemas for the `leitwegId` router.
//
// Structure + Modulo-11-10 check-digit validation happens inside
// `leitwegIdSchema` (from @contractor-ops/validators); these schemas layer
// the tRPC-specific shape on top (CUID FKs, default-flag, valid-from/to
// windows, notes).
//
// Kept as a separate module so both the router and any downstream UI
// client-side form validators can import the same source of truth.

import { leitwegIdSchema } from '@contractor-ops/validators';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared leaves
// ---------------------------------------------------------------------------

const cuidSchema = z.cuid();

// ---------------------------------------------------------------------------
// Mutations — create / update / delete / setDefault
// ---------------------------------------------------------------------------

/**
 * Create a new Leitweg-ID row for the caller's organization.
 *
 * `value` is validated against the full Leitweg-ID spec (structure +
 * Modulo-11-10 check digit) before the DB insert, so the router never needs
 * to catch an XRechnung-KoSIT check-digit error at finalize time.
 */
export const createLeitwegIdInput = z.object({
  value: leitwegIdSchema,
  description: z.string().max(200).optional(),
  contractorId: cuidSchema.nullish(),
  contractId: cuidSchema.nullish(),
  isDefaultForContractor: z.boolean().default(false),
  validFrom: z.coerce.date().nullish(),
  validTo: z.coerce.date().nullish(),
  notes: z.string().max(2000).nullish(),
});

export type CreateLeitwegIdInput = z.infer<typeof createLeitwegIdInput>;

export const updateLeitwegIdInput = createLeitwegIdInput.partial().extend({
  id: cuidSchema,
});

export type UpdateLeitwegIdInput = z.infer<typeof updateLeitwegIdInput>;

export const setDefaultInput = z.object({ id: cuidSchema });

export type SetDefaultInput = z.infer<typeof setDefaultInput>;

export const deleteLeitwegIdInput = z.object({ id: cuidSchema });

export type DeleteLeitwegIdInput = z.infer<typeof deleteLeitwegIdInput>;

// ---------------------------------------------------------------------------
// Queries — list / listByContractor / listByContract
// ---------------------------------------------------------------------------

export const listByContractorInput = z.object({ contractorId: cuidSchema });

export type ListByContractorInput = z.infer<typeof listByContractorInput>;

export const listByContractInput = z.object({ contractId: cuidSchema });

export type ListByContractInput = z.infer<typeof listByContractInput>;
