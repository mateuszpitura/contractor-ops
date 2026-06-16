import type { Prisma } from '@contractor-ops/db';

// ---------------------------------------------------------------------------
// US tax-form (W-9 / W-8BEN / W-8BEN-E) record service.
//
// Builds the immutable JSON snapshot that IS the legal record-of-record (the
// pixel-accurate IRS-form PDF is a later filing-phase concern) and owns the
// append-only supersede discipline: a signed form is never mutated in place —
// re-certification inserts a new ACTIVE row and flips the prior one to
// SUPERSEDED via the supersede chain.
//
// PII boundary: the snapshot NEVER carries a full SSN. The W-9 TIN reference
// keeps the last-4 only (the full value lives in the contractor's dedicated
// encrypted column behind the contractorPii:read reveal gate). buildFormSnapshot
// defensively strips any stray full-SSN key a caller leaks into the tin object
// so a forged payload cannot bypass the gate or the log PII mask.
//
// The ESIGN-Act attestation block (perjury acceptance, typed signer name, and
// the server-derived signedAt / ip / actorId) is embedded so the certification
// identity and timestamp cannot be forged by a client.
// ---------------------------------------------------------------------------

type TaxFormTypeLiteral = 'W9' | 'W8BEN' | 'W8BENE';

/** W-8BEN / W-8BEN-E claims expire three years after signing. */
const W8_VALIDITY_YEARS = 3;

/** Server-derived ESIGN attestation captured into the immutable snapshot. */
export interface SnapshotAttestation {
  perjuryAccepted: true;
  signerName: string;
  /** Server clock — never accepted from the client. */
  signedAt: Date;
  /** Derived server-side from request headers — never a client-supplied value. */
  ip: string;
  /** The signing identity (portal contractorId or staff userId) — server-derived. */
  actorId: string;
}

/** Resolved treaty claim mirrored onto the snapshot for W-8 forms. */
export interface SnapshotTreatyClaim {
  article: string | null;
  rate: number | null;
  residency: string | null;
}

export interface BuildFormSnapshotInput {
  formType: TaxFormTypeLiteral;
  /** Captured form fields (less the attestation, which is built server-side). */
  fields: Record<string, unknown>;
  attestation: SnapshotAttestation;
  treatyClaim?: SnapshotTreatyClaim;
}

export interface FormSnapshot {
  formType: TaxFormTypeLiteral;
  fields: Record<string, unknown>;
  attestation: {
    perjuryAccepted: true;
    signerName: string;
    signedAt: string;
    ip: string;
    actorId: string;
  };
  treatyClaim?: SnapshotTreatyClaim;
}

/** Keys never permitted in a captured-field payload — full personal identifiers. */
const FORBIDDEN_FIELD_KEYS = new Set(['ssn', 'ssnencrypted', 'fullssn', 'tin', 'fulltin']);

/**
 * Recursively drop any key that would carry a full SSN/TIN, keeping the last-4
 * reference. `tin` is allowed only as an object holding `ssnLast4` / `ein`; a
 * `tin` that is a bare string is dropped (we cannot prove it is not a full SSN).
 */
function sanitizeFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeFields);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      // The structured TIN reference object (ssnLast4 / ein) is retained, but a
      // scalar `tin` cannot be vetted, and explicit full-identifier keys are
      // dropped wholesale.
      if (lower === 'tin' && val !== null && typeof val === 'object') {
        out[key] = sanitizeFields(val);
        continue;
      }
      if (FORBIDDEN_FIELD_KEYS.has(lower)) {
        continue;
      }
      out[key] = sanitizeFields(val);
    }
    return out;
  }
  return value;
}

/**
 * Build the immutable snapshot payload for a tax-form submission.
 *
 * Embeds the captured fields (sanitized so no full SSN survives), the
 * server-derived ESIGN attestation block, and the resolved treaty claim for
 * W-8 forms. The returned object is the JSON written to `snapshotJson`.
 */
export function buildFormSnapshot(input: BuildFormSnapshotInput): FormSnapshot {
  const { formType, fields, attestation, treatyClaim } = input;

  const snapshot: FormSnapshot = {
    formType,
    fields: sanitizeFields(fields) as Record<string, unknown>,
    attestation: {
      perjuryAccepted: attestation.perjuryAccepted,
      signerName: attestation.signerName,
      signedAt: attestation.signedAt.toISOString(),
      ip: attestation.ip,
      actorId: attestation.actorId,
    },
  };

  if (treatyClaim) {
    snapshot.treatyClaim = treatyClaim;
  }

  return snapshot;
}

/**
 * Compute the form's expiry. W-8BEN / W-8BEN-E claims are valid ~3 years from
 * signing; a W-9 has no fixed expiry (returns null).
 */
export function computeExpiry(formType: TaxFormTypeLiteral, signedAt: Date): Date | null {
  if (formType === 'W9') {
    return null;
  }
  const expiry = new Date(signedAt);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + W8_VALIDITY_YEARS);
  return expiry;
}

/**
 * Minimal transactional client surface used by supersedeAndInsert — accepts a
 * Prisma `$transaction` tx (or the tenant-extended client) without coupling to
 * the full delegate type.
 */
export interface TaxFormTxClient {
  taxFormSubmission: {
    updateMany: (args: {
      where: Prisma.TaxFormSubmissionWhereInput;
      data: Prisma.TaxFormSubmissionUpdateManyMutationInput;
    }) => Promise<{ count: number }>;
    create: (args: {
      data: Prisma.TaxFormSubmissionUncheckedCreateInput;
    }) => Promise<{ id: string; status: string }>;
  };
}

export interface SupersedeAndInsertInput {
  contractorId: string;
  organizationId: string;
  formType: TaxFormTypeLiteral;
  snapshot: Record<string, unknown>;
  signerName: string;
  signedAt: Date;
  expiresAt: Date | null;
  treatyArticle?: string | null;
  treatyRate?: number | null;
  contractorResidency?: string | null;
}

/**
 * Append-only re-certification within the caller's transaction.
 *
 * (1) Flips every prior ACTIVE row for this contractor + formType to SUPERSEDED,
 * then (2) inserts the new row as ACTIVE. The supersede MUST run before the
 * insert so a contractor never has two concurrent ACTIVE rows for one form.
 * Signed rows are never mutated in place — re-cert always creates a new row.
 */
export async function supersedeAndInsert(
  tx: TaxFormTxClient,
  input: SupersedeAndInsertInput,
): Promise<{ id: string; status: string }> {
  const {
    contractorId,
    organizationId,
    formType,
    snapshot,
    signerName,
    signedAt,
    expiresAt,
    treatyArticle = null,
    treatyRate = null,
    contractorResidency = null,
  } = input;

  await tx.taxFormSubmission.updateMany({
    where: {
      organizationId,
      contractorId,
      formType,
      status: 'ACTIVE',
    },
    data: { status: 'SUPERSEDED' },
  });

  return tx.taxFormSubmission.create({
    data: {
      organizationId,
      contractorId,
      formType,
      status: 'ACTIVE',
      snapshotJson: snapshot as Prisma.InputJsonValue,
      treatyArticle,
      treatyRate,
      contractorResidency,
      signerName,
      signedAt,
      expiresAt,
    },
  });
}
