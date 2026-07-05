import type { Prisma } from '@contractor-ops/db';
import type { Iris1042SSubmissionInput } from '@contractor-ops/iris';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { clear, complete, reserve } from '../../lib/idempotency';
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
import { buildAndValidate1042S } from '../../services/form-1042s-transmit.service';
import { parseIrisAck } from '../../services/iris-ack-parser';
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

/**
 * IRS Publication 1187 schema version the 1042-S payload is built against —
 * distinct from the 1099 IRIS schema. ADVISER-VERIFY + re-pin per tax year
 * against the downloaded IRS SOR (Pub 1187) package before production filing.
 * Also the discriminator that keeps a 1042-S IrisSubmission from being matched by
 * a 1099 acknowledgement (and vice versa) on the shared submission ledger.
 */
const FORM_1042S_SCHEMA_VERSION = { versionNum: 'PUB1187-1.0', versionDt: '2025-11-06' } as const;

const TRANSMIT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/** Format a recipient foreign TIN last-4 into the masked IRIS payload form. */
function maskFtin(last4: string | null | undefined): string {
  return `XXX-XX-${(last4 ?? '0000').slice(-4)}`;
}

/** A whole-percent Decimal rate (e.g. `15.00`) as basis points (`1500`). */
function rateToBasisPoints(rate: Prisma.Decimal | null): number {
  return rate === null ? 0 : Math.round(Number(rate) * 100);
}

/** The ACTIVE 1042-S columns needed to assemble the IRIS payload. */
interface Form1042STransmitRow {
  box1IncomeCode: string | null;
  box2GrossIncomeMinor: number;
  box3aChap3ExemptionCode: string | null;
  box3bChap3Rate: Prisma.Decimal | null;
  box4aChap4ExemptionCode: string | null;
  box4bChap4Rate: Prisma.Decimal | null;
  box7FederalTaxWithheldMinor: number;
  recipientChap3StatusCode: string | null;
  recipientChap4StatusCode: string | null;
  recipientLobCode: string | null;
  treatyArticle: string | null;
  recipient: { legalName: string; ssnLast4: string | null };
}

/**
 * Assemble the canonical Pub 1187 submission input from the org's ACTIVE 1042-S
 * rows. The recipient FTIN is the last-4 mask — a full foreign TIN never enters
 * the IRIS payload. Pure (no DB): the procedure fetches the rows so the scoped
 * tenant client stays the sole data boundary.
 */
function buildIris1042SInput(
  taxYear: number,
  withholdingAgentName: string,
  rows: Form1042STransmitRow[],
): Iris1042SSubmissionInput {
  return {
    taxYear,
    schemaVersion: FORM_1042S_SCHEMA_VERSION,
    withholdingAgent: {
      // The withholding-agent EIN is captured at enablement; a full EIN never
      // comes from client input. ADVISER-VERIFY before production filing.
      tin: '000000000',
      name: withholdingAgentName,
    },
    recipients: rows.map(row => ({
      recipientFtin: maskFtin(row.recipient.ssnLast4),
      recipientName: row.recipient.legalName,
      incomeCode: row.box1IncomeCode ?? INDEPENDENT_SERVICES_INCOME_CODE,
      grossIncomeBox2Minor: row.box2GrossIncomeMinor,
      chap3ExemptionCode: row.box3aChap3ExemptionCode ?? '',
      chap3RateBp: rateToBasisPoints(row.box3bChap3Rate),
      chap4ExemptionCode: row.box4aChap4ExemptionCode ?? '',
      chap4RateBp: rateToBasisPoints(row.box4bChap4Rate),
      federalTaxWithheldBox7Minor: row.box7FederalTaxWithheldMinor,
      recipientChap3StatusCode: row.recipientChap3StatusCode ?? '',
      recipientChap4StatusCode: row.recipientChap4StatusCode ?? '',
      recipientLobCode: row.recipientLobCode ?? '',
      treatyArticle: row.treatyArticle ?? '',
    })),
  };
}

/** The ACTIVE-row select shared by the build/validate + download procedures. */
const TRANSMIT_ROW_SELECT = {
  box1IncomeCode: true,
  box2GrossIncomeMinor: true,
  box3aChap3ExemptionCode: true,
  box3bChap3Rate: true,
  box4aChap4ExemptionCode: true,
  box4bChap4Rate: true,
  box7FederalTaxWithheldMinor: true,
  recipientChap3StatusCode: true,
  recipientChap4StatusCode: true,
  recipientLobCode: true,
  treatyArticle: true,
  recipient: { select: { legalName: true, ssnLast4: true } },
} as const;

export const form1042sRouter = router({
  /**
   * List filed 1042-S forms for a tax year — status / figures + the recipient's
   * legal name and FTIN last-4 for the staff review surface. The full foreign TIN
   * is never selected here; the last-4 is the only recipient-identifier fragment
   * that leaves the server on this path (the gated full reveal is a separate
   * procedure). Scoped to the staff tenant org.
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
          recipient: { select: { legalName: true, ssnLast4: true } },
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
   * Build the Pub 1187 1042-S XML for the tax-year batch and XSD-validate it,
   * returning the validation report (never the raw XML on this path). Until the
   * IRS 1042-S XSD bundle is placed the report is BUNDLE_UNAVAILABLE (validity
   * unproven) — nothing files on that outcome. Review-before-file: this never
   * transmits.
   */
  buildAndValidateXml: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ taxYear: z.number().int().min(2020).max(2100) }).strict())
    .query(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true, legalName: true },
      });
      const rows = await ctx.db.form1042S.findMany({
        where: {
          organizationId: ctx.organizationId,
          payerOrgId: ctx.organizationId,
          taxYear: input.taxYear,
          status: 'ACTIVE',
        },
        select: TRANSMIT_ROW_SELECT,
      });

      const agentName = org?.legalName ?? org?.name ?? ctx.organizationId;
      const result = await buildAndValidate1042S(
        buildIris1042SInput(input.taxYear, agentName, rows),
      );

      return {
        taxYear: input.taxYear,
        recipientCount: rows.length,
        status: result.validation.status,
        ready: result.ready,
        errors: result.validation.errors,
      };
    }),

  /**
   * ManualDownload: build + XSD-validate the 1042-S XML and, when valid, return it
   * for the operator to download and upload to IRIS. Records the IrisSubmission
   * once per (org, tax year) via idempotency so a retried download does not create
   * duplicate submission rows, and stamps the Pub 1187 schema version so the
   * shared submission ledger never confuses a 1042-S with a 1099. Audited.
   */
  downloadValidatedXml: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(z.object({ taxYear: z.number().int().min(2020).max(2100) }).strict())
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true, legalName: true },
      });
      const rows = await ctx.db.form1042S.findMany({
        where: {
          organizationId: ctx.organizationId,
          payerOrgId: ctx.organizationId,
          taxYear: input.taxYear,
          status: 'ACTIVE',
        },
        select: TRANSMIT_ROW_SELECT,
      });

      const agentName = org?.legalName ?? org?.name ?? ctx.organizationId;
      const result = await buildAndValidate1042S(
        buildIris1042SInput(input.taxYear, agentName, rows),
      );

      if (!(result.ready && result.xml)) {
        return {
          taxYear: input.taxYear,
          ready: false as const,
          status: result.validation.status,
          errors: result.validation.errors,
        };
      }

      const key = `form1042s:transmit:${ctx.organizationId}:${input.taxYear}`;
      const hit = await reserve<{ submissionId: string }>(key, TRANSMIT_IDEMPOTENCY_TTL_SECONDS);
      let submissionId: string | undefined;
      if (hit.kind === 'HIT') {
        submissionId = hit.result.submissionId;
      } else if (hit.kind === 'MISS') {
        try {
          const submission = await ctx.db.irisSubmission.create({
            data: {
              organizationId: ctx.organizationId,
              taxYear: input.taxYear,
              schemaVersionNum: FORM_1042S_SCHEMA_VERSION.versionNum,
              schemaVersionDt: FORM_1042S_SCHEMA_VERSION.versionDt,
              transmitMethod: 'manual',
            },
            select: { id: true },
          });
          submissionId = submission.id;
          await writeAuditLog({
            organizationId: ctx.organizationId,
            actorType: 'USER',
            actorId: ctx.user.id,
            action: 'form1042s.iris.xml_downloaded',
            resourceType: 'ORGANIZATION',
            resourceId: ctx.organizationId,
            metadata: { taxYear: input.taxYear, submissionId, transmitMethod: 'manual' },
          });
          await complete(key, { submissionId }, TRANSMIT_IDEMPOTENCY_TTL_SECONDS);
        } catch (err) {
          await clear(key);
          throw err;
        }
      }

      return {
        taxYear: input.taxYear,
        ready: true as const,
        status: result.validation.status,
        submissionId,
        xml: result.xml,
      };
    }),

  /**
   * Parse an uploaded IRS 1042-S acknowledgement file, update the submission's
   * status, and append an immutable IrisAck row with the Error Information Group.
   * The submission lookup is scoped to the Pub 1187 schema version so a 1042-S ack
   * never lands on a 1099 submission for the same (org, tax year). The ack file is
   * untrusted — `parseIrisAck` is XXE-safe and never `as`-casts.
   */
  uploadAck: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z
        .object({
          taxYear: z.number().int().min(2020).max(2100),
          submissionId: z.string().min(1).optional(),
          ackXml: z.string().min(1).max(5_000_000),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      let parsed: ReturnType<typeof parseIrisAck>;
      try {
        parsed = parseIrisAck(input.ackXml);
      } catch {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.IRIS_ACK_PARSE_FAILED });
      }

      const submission = await ctx.db.irisSubmission.findFirst({
        where: {
          organizationId: ctx.organizationId,
          taxYear: input.taxYear,
          schemaVersionNum: FORM_1042S_SCHEMA_VERSION.versionNum,
          ...(input.submissionId ? { id: input.submissionId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        select: { id: true },
      });
      if (!submission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORM_1042S_NOT_FOUND });
      }

      await ctx.db.$transaction(async tx => {
        await tx.irisSubmission.update({
          where: { id: submission.id },
          data: {
            status: parsed.status,
            ...(parsed.originalReceiptId ? { originalReceiptId: parsed.originalReceiptId } : {}),
          },
        });
        await tx.irisAck.create({
          data: {
            organizationId: ctx.organizationId,
            submissionId: submission.id,
            status: parsed.status,
            receiptId: parsed.receiptId ?? null,
            ...(parsed.errorInformation.length > 0
              ? {
                  errorInformationJson: parsed.errorInformation as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'form1042s.iris.ack_uploaded',
          resourceType: 'ORGANIZATION',
          resourceId: submission.id,
          metadata: {
            taxYear: input.taxYear,
            ackStatus: parsed.status,
            errorCount: parsed.errorInformation.length,
          },
        });
      });

      return {
        submissionId: submission.id,
        status: parsed.status,
        errorCount: parsed.errorInformation.length,
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
