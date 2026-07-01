import type { Prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { assertUsExpansionEnabled } from '../../middleware/require-us-expansion-flag';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import type { BatchRecipient1042S } from '../../services/form-1042s.service';
import {
  buildForm1042SSnapshot,
  fileCorrection1042S,
  generateBatch1042S,
  resolveBox2Rate,
} from '../../services/form-1042s.service';
import { form1042sArchiveKey, renderAndArchiveRecipientCopy } from '../../services/form-1042s-pdf';
import { signExistingDownload } from '../../services/r2';
import { decryptSsn } from '../../services/ssn-crypto';
import { applyTreaty } from '../../services/treaty-rate.service';

// ---------------------------------------------------------------------------
// Staff Form 1042-S surface — generate / correct / recipient-copy.
//
// Ships dark behind `module.us-expansion`: the router is conditionally spread
// into appRouter at boot (root.ts), and every procedure re-evaluates the flag
// per request via `assertUsExpansionEnabled` (defense-in-depth). Box figures are
// ALWAYS computed server-side from settled payments + the W-form on file — the
// client input carries only a tax year / form id, never a box amount or rate
// (mass-assignment guard). The full recipient FTIN reveal stays behind
// `contractorPii:read`; every other surface uses the masked snapshot.
// ---------------------------------------------------------------------------

/**
 * i1042-S income code (Appendix B) for compensation for independent personal
 * services. The exact code per tax year is adviser-verify before production
 * filing; captured on the snapshot alongside the adviser-verify note.
 */
const INDEPENDENT_SERVICES_INCOME_CODE = '17';

/** A W-8 chain is complete when the form is signed and not past its expiry. */
function isW8ChainComplete(submission: { signedAt: Date | null; expiresAt: Date | null }): boolean {
  if (!submission.signedAt) {
    return false;
  }
  return submission.expiresAt === null || submission.expiresAt.getTime() > Date.now();
}

/**
 * Sum settled (PAID) USD payouts for one recipient within the calendar tax year
 * — the box-2 gross income, computed server-side from the payment ledger so a
 * client can never assert the figure. Non-USD payouts are out of scope for this
 * reported-only core (the US payment rail owns FX-settled payouts); only USD
 * settlements are aggregated here.
 */
async function aggregateBox2GrossMinor(
  db: {
    paymentRunItem: {
      findMany: (args: {
        where: Prisma.PaymentRunItemWhereInput;
        select: { amountMinor: true };
      }) => Promise<{ amountMinor: number }[]>;
    };
  },
  organizationId: string,
  contractorId: string,
  taxYear: number,
): Promise<number> {
  const from = new Date(Date.UTC(taxYear, 0, 1));
  const to = new Date(Date.UTC(taxYear + 1, 0, 1));

  const items = await db.paymentRunItem.findMany({
    where: {
      organizationId,
      contractorId,
      status: 'PAID',
      currency: 'USD',
      paymentRun: { completedAt: { gte: from, lt: to } },
    },
    select: { amountMinor: true },
  });

  return items.reduce((sum, item) => sum + item.amountMinor, 0);
}

/** Round the chapter-3 tax withheld (box 7) from a gross amount + whole-percent rate. */
function chap3WithheldMinor(box2GrossMinor: number, ratePercent: number): number {
  return Math.round((box2GrossMinor * ratePercent) / 100);
}

export const form1042sRouter = router({
  /**
   * List filed 1042-S forms for a tax year — status / figures only, never a full
   * FTIN. Scoped to the staff tenant org.
   */
  list: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ taxYear: z.number().int().min(2020).max(2100).optional() }).strict())
    .query(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      return ctx.db.form1042S.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input.taxYear ? { taxYear: input.taxYear } : {}),
        },
        select: {
          id: true,
          recipientId: true,
          taxYear: true,
          status: true,
          corrected: true,
          box1IncomeCode: true,
          box2GrossIncomeMinor: true,
          box3bChap3Rate: true,
          box7FederalTaxWithheldMinor: true,
          treatyArticle: true,
          currency: true,
          pdfArchiveKey: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
      });
    }),

  /**
   * Generate the tax-year 1042-S batch for the staff org. Recipients are the
   * active W-8 submissions on file; box figures are aggregated server-side from
   * settled payouts. Idempotent + audited (delegated to the service).
   */
  generateBatch: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(z.object({ taxYear: z.number().int().min(2020).max(2100) }).strict())
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });
      const payerName = org?.name ?? ctx.organizationId;

      const submissions = await ctx.db.taxFormSubmission.findMany({
        where: {
          organizationId: ctx.organizationId,
          formType: { in: ['W8BEN', 'W8BENE'] },
          supersededById: null,
        },
        select: {
          formType: true,
          contractorResidency: true,
          signedAt: true,
          expiresAt: true,
          contractor: { select: { id: true, legalName: true, ssnLast4: true } },
        },
      });

      const recipients: BatchRecipient1042S[] = [];
      for (const submission of submissions) {
        const contractor = submission.contractor;
        const w8ChainComplete = isW8ChainComplete(submission);
        const box2GrossIncomeMinor = await aggregateBox2GrossMinor(
          ctx.db,
          ctx.organizationId,
          contractor.id,
          input.taxYear,
        );
        if (box2GrossIncomeMinor <= 0) {
          continue;
        }

        const box2 = await resolveBox2Rate({
          contractorResidency: submission.contractorResidency ?? 'XX',
          w8ChainComplete,
          resolveTreaty: applyTreaty,
        });

        recipients.push({
          recipientId: contractor.id,
          formType: submission.formType,
          payerName,
          recipientName: contractor.legalName,
          recipientFtinLast4: contractor.ssnLast4 ?? '',
          contractorResidency: submission.contractorResidency ?? 'XX',
          w8ChainComplete,
          box2GrossIncomeMinor,
          box7FederalTaxWithheldMinor: chap3WithheldMinor(box2GrossIncomeMinor, box2.rate),
          box1IncomeCode: INDEPENDENT_SERVICES_INCOME_CODE,
        });
      }

      const result = await generateBatch1042S(
        {
          organizationId: ctx.organizationId,
          payerOrgId: ctx.organizationId,
          taxYear: input.taxYear,
          recipients,
        },
        {
          db: ctx.db,
          persist: ctx.db,
          resolveTreaty: applyTreaty,
          actorId: ctx.user.id,
          actorType: 'USER',
        },
      );

      return {
        taxYear: input.taxYear,
        idempotent: result.idempotent,
        generatedCount: result.generated.length,
        skippedCount: result.skippedRecipientIds.length,
        escalatedCount: result.escalatedRecipientIds.length,
      };
    }),

  /**
   * File a CORRECTED 1042-S: re-derive the recipient's figures server-side,
   * supersede the prior ACTIVE row, and insert the new ACTIVE row in one
   * transaction. Audited (delegated to the service). The filed row is never
   * mutated in place.
   */
  fileCorrection: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z
        .object({
          formId: z.string().min(1),
          reason: z.string().min(1).max(500),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const form = await ctx.db.form1042S.findFirst({
        where: {
          id: input.formId,
          organizationId: ctx.organizationId,
          status: 'ACTIVE',
        },
        select: {
          recipientId: true,
          payerOrgId: true,
          taxYear: true,
          box1IncomeCode: true,
        },
      });
      if (!form) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORM_1042S_NOT_FOUND });
      }

      const submission = await ctx.db.taxFormSubmission.findFirst({
        where: {
          organizationId: ctx.organizationId,
          contractorId: form.recipientId,
          formType: { in: ['W8BEN', 'W8BENE'] },
          supersededById: null,
        },
        select: {
          formType: true,
          contractorResidency: true,
          signedAt: true,
          expiresAt: true,
          contractor: { select: { legalName: true, ssnLast4: true } },
        },
      });
      if (!submission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });

      const w8ChainComplete = isW8ChainComplete(submission);
      const box2GrossIncomeMinor = await aggregateBox2GrossMinor(
        ctx.db,
        ctx.organizationId,
        form.recipientId,
        form.taxYear,
      );
      const box2 = await resolveBox2Rate({
        contractorResidency: submission.contractorResidency ?? 'XX',
        w8ChainComplete,
        resolveTreaty: applyTreaty,
      });
      const box3bChap3RateBp = Math.round(box2.rate * 100);
      const box7FederalTaxWithheldMinor = chap3WithheldMinor(box2GrossIncomeMinor, box2.rate);
      const box1IncomeCode = form.box1IncomeCode ?? INDEPENDENT_SERVICES_INCOME_CODE;

      const snapshotJson = buildForm1042SSnapshot({
        taxYear: form.taxYear,
        payerOrgId: form.payerOrgId,
        recipientId: form.recipientId,
        payerName: org?.name ?? ctx.organizationId,
        recipientName: submission.contractor.legalName,
        recipientFtinLast4: submission.contractor.ssnLast4 ?? '',
        box1IncomeCode,
        box2GrossIncomeMinor,
        box3bChap3RateBp,
        box7FederalTaxWithheldMinor,
        treatyArticle: box2.article,
        corrected: true,
      });

      const created = await ctx.db.$transaction(tx =>
        fileCorrection1042S(tx, {
          organizationId: ctx.organizationId,
          payerOrgId: form.payerOrgId,
          recipientId: form.recipientId,
          taxYear: form.taxYear,
          snapshotJson: snapshotJson as unknown as Prisma.InputJsonValue,
          box2GrossIncomeMinor,
          box7FederalTaxWithheldMinor,
          box1IncomeCode,
          box3bChap3RateBp,
          treatyArticle: box2.article,
          actorId: ctx.user.id,
          actorType: 'USER',
        }),
      );

      return { id: created.id, status: created.status, reason: input.reason };
    }),

  /**
   * Render (if needed) and return a short-TTL signed URL for the recipient-copy
   * PDF. The PDF is rendered from the immutable masked snapshot — no full FTIN.
   */
  getRecipientCopyUrl: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ formId: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const form = await ctx.db.form1042S.findFirst({
        where: { id: input.formId, organizationId: ctx.organizationId },
        select: { id: true, taxYear: true },
      });
      if (!form) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORM_1042S_NOT_FOUND });
      }

      await renderAndArchiveRecipientCopy(ctx.db, form.id);
      const key = form1042sArchiveKey(ctx.organizationId, form.id);
      const { signedUrl, expiresInSeconds } = await signExistingDownload(
        key,
        300,
        `1042-s-${form.taxYear}.pdf`,
      );

      return { signedUrl, expiresInSeconds };
    }),

  /**
   * Reveal the full recipient FTIN — staff-router only, gated by
   * `contractorPii:read`, and audited. Every other surface uses the last-4 mask.
   */
  revealRecipientFtin: tenantProcedure
    .use(requirePermission({ contractorPii: ['read'] }))
    .input(z.object({ formId: z.string().min(1) }).strict())
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const form = await ctx.db.form1042S.findFirst({
        where: { id: input.formId, organizationId: ctx.organizationId },
        select: { id: true, recipientId: true },
      });
      if (!form) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORM_1042S_NOT_FOUND });
      }

      const contractor = await ctx.db.contractor.findFirst({
        where: { id: form.recipientId, organizationId: ctx.organizationId },
        select: { id: true, ssnEncrypted: true },
      });
      if (!contractor?.ssnEncrypted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      const ftin = decryptSsn(contractor.ssnEncrypted);

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'form1042s.ftin.revealed',
        resourceType: 'CONTRACTOR',
        resourceId: contractor.id,
        metadata: { formId: form.id },
      });

      return { ftin };
    }),
});
