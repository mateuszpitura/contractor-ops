import type { Prisma } from '@contractor-ops/db';
import { taxFormSubmissionSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { portalProcedure } from '../../middleware/portal-auth';
import { assertUsExpansionEnabled } from '../../middleware/require-us-expansion-flag';
import { writeAuditLog } from '../../services/audit-writer';
import type { SnapshotTreatyClaim } from '../../services/tax-form.service';
import {
  buildFormSnapshot,
  computeExpiry,
  sanitizeFields,
  supersedeAndInsert,
} from '../../services/tax-form.service';
import { determineFormType } from '../../services/tax-form-routing';
import { applyTreaty } from '../../services/treaty-rate.service';

// ---------------------------------------------------------------------------
// Portal-primary W-form intake (W-9 / W-8BEN / W-8BEN-E).
//
// The beneficial owner self-certifies: every procedure is scoped to the
// portal-session `ctx.contractorId` + `ctx.organizationId` — a client-supplied
// contractorId is never trusted (IDOR guard). The ESIGN attestation IP + actor
// identity are derived server-side from the session/headers; the signedAt is
// the server clock. The record is append-only: only DRAFT rows are
// mutable, and a submit supersedes the prior ACTIVE row inside one transaction.
//
// The whole surface is gated behind `module.us-expansion`: each procedure
// re-evaluates the flag for the caller's org/region before any business logic
// (the portal router is a flat merge that cannot be conditionally spread).
// ---------------------------------------------------------------------------

/** Coarse contractor entity type accepted by the form router. */
const CONTRACTOR_TYPES = ['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER'] as const;

/**
 * Derive the client IP server-side from the trusted-proxy headers. Never accept
 * a client-body IP — the attestation identity must not be forgeable.
 */
function deriveClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? 'unknown'
  );
}

/** Resolve the treaty claim for a W-8 form from the contractor's residency. */
async function resolveW8TreatyClaim(residency: string): Promise<SnapshotTreatyClaim> {
  const decision = await applyTreaty({ contractorResidency: residency });
  return { article: decision.article, rate: decision.rate, residency };
}

export const portalTaxFormRouter = router({
  /**
   * Route the contractor's W-form from the existing profile and auto-populate
   * the treaty claim (article + rate) for W-8 forms. Confirm/override happens
   * client-side; this is the determination + prefill source.
   */
  getTaxFormDetermination: portalProcedure.query(async ({ ctx }) => {
    assertUsExpansionEnabled(ctx.organizationId, ctx.region);

    const contractor = await ctx.db.contractor.findUnique({
      where: { id: ctx.contractorId },
      select: { id: true, countryCode: true, type: true, legalName: true, displayName: true },
    });
    if (!contractor) {
      throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
    }

    const formType = determineFormType({
      countryCode: contractor.countryCode ?? '',
      contractorType: (CONTRACTOR_TYPES as readonly string[]).includes(contractor.type ?? '')
        ? (contractor.type as (typeof CONTRACTOR_TYPES)[number])
        : 'OTHER',
    });

    const treatyClaim =
      formType === 'W9' || !contractor.countryCode
        ? null
        : await resolveW8TreatyClaim(contractor.countryCode);

    return {
      formType,
      countryCode: contractor.countryCode,
      legalName: contractor.legalName,
      displayName: contractor.displayName,
      treatyClaim,
    };
  }),

  /**
   * List the contractor's own forms (status + expiry). NEVER selects encrypted
   * PII; the snapshot is intentionally excluded from the list projection.
   */
  getMyTaxForms: portalProcedure.query(async ({ ctx }) => {
    assertUsExpansionEnabled(ctx.organizationId, ctx.region);

    return ctx.db.taxFormSubmission.findMany({
      where: { contractorId: ctx.contractorId, organizationId: ctx.organizationId },
      select: {
        id: true,
        formType: true,
        status: true,
        treatyArticle: true,
        treatyRate: true,
        contractorResidency: true,
        signerName: true,
        signedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }),

  /**
   * Upsert the contractor's working DRAFT for a form type. Only a DRAFT is
   * mutable — an ACTIVE/SUPERSEDED row is never edited in place.
   */
  saveTaxFormDraft: portalProcedure
    .input(
      z.object({
        formType: z.enum(['W9', 'W8BEN', 'W8BENE']),
        draft: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const existingDraft = await ctx.db.taxFormSubmission.findFirst({
        where: {
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
          formType: input.formType,
          status: 'DRAFT',
        },
        select: { id: true },
      });

      // Route the raw client draft through the same forbidden-key sanitizer the
      // submit path uses — a full SSN/TIN must never reach `snapshotJson`, even
      // in an unsigned draft.
      const snapshotJson = {
        formType: input.formType,
        draft: sanitizeFields(input.draft) as Record<string, unknown>,
      } satisfies Record<string, unknown> as Prisma.InputJsonValue;

      if (existingDraft) {
        return ctx.db.taxFormSubmission.update({
          where: { id: existingDraft.id },
          data: { snapshotJson },
          select: { id: true, status: true, formType: true },
        });
      }

      return ctx.db.taxFormSubmission.create({
        data: {
          organizationId: ctx.organizationId,
          contractorId: ctx.contractorId,
          formType: input.formType,
          status: 'DRAFT',
          snapshotJson,
        },
        select: { id: true, status: true, formType: true },
      });
    }),

  /**
   * Submit a self-certified form. Resolves the treaty claim, builds the
   * immutable snapshot with the server-derived ESIGN attestation, supersedes
   * the prior ACTIVE row, inserts the new ACTIVE row, and writes the audit —
   * all in one transaction.
   */
  submitTaxForm: portalProcedure.input(taxFormSubmissionSchema).mutation(async ({ ctx, input }) => {
    assertUsExpansionEnabled(ctx.organizationId, ctx.region);

    const signedAt = new Date();
    const ip = deriveClientIp(ctx.headers);

    // Resolve the treaty claim for W-8 forms from the contractor's residency
    // (the treaty country claimed on the form). W-9 carries no treaty claim.
    let treatyClaim: SnapshotTreatyClaim | undefined;
    if (input.formType !== 'W9') {
      treatyClaim = await resolveW8TreatyClaim(input.treatyCountry);
    }

    const { perjuryAccepted, signerName, ...capturedFields } = input;

    const snapshot = buildFormSnapshot({
      formType: input.formType,
      fields: capturedFields,
      attestation: {
        perjuryAccepted,
        signerName,
        signedAt,
        ip,
        actorId: ctx.contractorId,
      },
      treatyClaim,
    });

    const expiresAt = computeExpiry(input.formType, signedAt);

    return ctx.db.$transaction(async tx => {
      const inserted = await supersedeAndInsert(tx, {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
        formType: input.formType,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        signerName,
        signedAt,
        expiresAt,
        treatyArticle: treatyClaim?.article ?? null,
        treatyRate: treatyClaim?.rate ?? null,
        contractorResidency: treatyClaim?.residency ?? null,
      });

      await writeAuditLog({
        tx,
        organizationId: ctx.organizationId,
        actorType: 'CONTRACTOR',
        actorId: ctx.contractorId,
        action: 'tax.form.submitted',
        resourceType: 'CONTRACTOR',
        resourceId: ctx.contractorId,
        ipAddress: ip,
        metadata: {
          taxFormSubmissionId: inserted.id,
          formType: input.formType,
          treatyArticle: treatyClaim?.article ?? null,
          treatyRate: treatyClaim?.rate ?? null,
        },
      });

      return { id: inserted.id, status: inserted.status, formType: input.formType };
    });
  }),
});
