import type { Prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { clear, complete, reserve } from '../../lib/idempotency';
import { requirePermission } from '../../middleware/rbac';
import { usExpansionProcedure } from '../../middleware/us-expansion-procedures';
import { writeAuditLog } from '../../services/audit-writer';
import type { BatchRecipient, SettledPayment } from '../../services/form-1099-nec.service';
import {
  buildForm1099NecSnapshot,
  fileCorrection,
  generateBatch,
  resolveW9TinMismatch,
  sumBackupWithholdingUsdMinor,
} from '../../services/form-1099-nec.service';
import { parseIrisAck } from '../../services/iris-ack-parser';
import { buildStateFilingOutput } from '../../services/state-filing-output';
import { createTaxFilingTransmitter } from '../../services/tax-filing-transmitter';

// ---------------------------------------------------------------------------
// Staff Form 1099-NEC year-end filing surface.
//
// Ships dark behind `module.us-expansion`: the router is conditionally spread
// into appRouter at boot (root.ts), and every procedure re-evaluates the flag
// per request via `assertUsExpansionEnabled` (defense-in-depth). Box figures are
// ALWAYS computed server-side from settled payments + the W-9 on file; the
// client input carries only a tax year / form id / uploaded ack — never a box
// amount, rate, status, or org (mass-assignment guard). The full recipient TIN
// never leaves the server: the IRIS payload + every read use the last-4 mask.
//
// Generate and File are separate, deliberate, human-initiated actions — there is
// no auto-file path (the year-end cron only reminds). A TIN mismatch is advisory
// (escalate/resolve + audit); it never hard-blocks generation.
// ---------------------------------------------------------------------------

/**
 * IRS IRIS schema version the payload is built against. ADVISER-VERIFY + re-pin
 * per tax year against the downloaded IRS SOR package before production filing.
 */
const IRIS_SCHEMA_VERSION = { versionNum: '2.0', versionDt: '2025-11-06' } as const;

/** Format a recipient TIN last-4 into the masked IRIS payload form. */
function maskTin(last4: string | null | undefined): string {
  return `XXX-XX-${(last4 ?? '0000').slice(-4)}`;
}

const taxYearInput = z.object({ taxYear: z.number().int().min(2020).max(2100) }).strict();

/**
 * Load the org's ACTIVE 1099-NEC rows for a tax year and assemble the canonical
 * IRIS submission input. The recipient TIN is the last-4 mask — a full SSN never
 * enters the IRIS payload.
 */
async function assembleIrisInput(
  db: {
    organization: {
      findUnique: (args: {
        where: { id: string };
        select: { name: true; legalName: true; countryCode: true };
      }) => Promise<{ name: string; legalName: string | null; countryCode: string | null } | null>;
    };
    form1099Nec: {
      findMany: (args: {
        where: Prisma.Form1099NecWhereInput;
        select: {
          box1AmountMinor: true;
          box4BackupWithholdingMinor: true;
          cfsfStateCode: true;
          recipient: { select: { legalName: true; ssnLast4: true } };
        };
      }) => Promise<
        {
          box1AmountMinor: number;
          box4BackupWithholdingMinor: number;
          cfsfStateCode: string | null;
          recipient: { legalName: string; ssnLast4: string | null };
        }[]
      >;
    };
  },
  organizationId: string,
  taxYear: number,
) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, legalName: true, countryCode: true },
  });
  const rows = await db.form1099Nec.findMany({
    where: { organizationId, payerOrgId: organizationId, taxYear, status: 'ACTIVE' },
    select: {
      box1AmountMinor: true,
      box4BackupWithholdingMinor: true,
      cfsfStateCode: true,
      recipient: { select: { legalName: true, ssnLast4: true } },
    },
  });

  return {
    taxYear,
    schemaVersion: IRIS_SCHEMA_VERSION,
    payer: {
      // The payer EIN is captured at enablement; a full EIN never comes from
      // client input. ADVISER-VERIFY before production filing.
      tin: '000000000',
      name: org?.legalName ?? org?.name ?? organizationId,
      stateCode: org?.countryCode ?? '',
    },
    payees: rows.map(r => ({
      recipientTin: maskTin(r.recipient.ssnLast4),
      recipientName: r.recipient.legalName,
      box1AmountMinor: r.box1AmountMinor,
      box4BackupWithholdingMinor: r.box4BackupWithholdingMinor,
      cfsfStateCode: r.cfsfStateCode ?? '',
    })),
    rowCount: rows.length,
  };
}

export const tax1099Router = router({
  /**
   * List filed 1099-NEC forms for a tax year — status + box figures + the
   * recipient's legal name and TIN last-4 for the staff review surface. Scoped
   * to the caller's org; the full TIN is never selected.
   */
  list: usExpansionProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ taxYear: z.number().int().min(2020).max(2100).optional() }).strict())
    .query(async ({ ctx, input }) => {
      return ctx.db.form1099Nec.findMany({
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
          box1AmountMinor: true,
          box4BackupWithholdingMinor: true,
          cfsfStateCode: true,
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
   * Generate the tax-year 1099-NEC batch for the staff org. Recipients are the
   * active W-9 submissions on file; box-1 is aggregated server-side from settled
   * payouts (FX-converted), gated by the tax-year threshold table. Idempotent +
   * audited (delegated to the service). Review-before-file — this never
   * transmits.
   */
  generateBatch: usExpansionProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(taxYearInput)
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true, legalName: true },
      });
      const payerName = org?.legalName ?? org?.name ?? ctx.organizationId;

      const from = new Date(Date.UTC(input.taxYear, 0, 1));
      const to = new Date(Date.UTC(input.taxYear + 1, 0, 1));

      const submissions = await ctx.db.taxFormSubmission.findMany({
        where: {
          organizationId: ctx.organizationId,
          formType: 'W9',
          status: 'ACTIVE',
        },
        select: {
          snapshotJson: true,
          contractor: {
            select: { id: true, legalName: true, ssnLast4: true, backupWithholdingFlagged: true },
          },
        },
      });

      const recipients: BatchRecipient[] = [];
      for (const submission of submissions) {
        const contractor = submission.contractor;

        const items = await ctx.db.paymentRunItem.findMany({
          where: {
            organizationId: ctx.organizationId,
            contractorId: contractor.id,
            status: 'PAID',
            paymentRun: { completedAt: { gte: from, lt: to } },
          },
          select: {
            grossAmountMinor: true,
            amountMinor: true,
            whtAmountMinor: true,
            whtRate: true,
            currency: true,
            paymentRun: { select: { completedAt: true } },
          },
        });
        if (items.length === 0) {
          continue;
        }

        const payments: SettledPayment[] = items.map(item => ({
          recipientId: contractor.id,
          payerOrgId: ctx.organizationId,
          paymentDate: item.paymentRun.completedAt ?? from,
          amountMinor: item.grossAmountMinor ?? item.amountMinor,
          currency: item.currency,
        }));

        const recordedBackupWithholdingMinor = await sumBackupWithholdingUsdMinor(ctx.db, items);
        const tinMismatch = resolveW9TinMismatch({
          contractorSsnLast4: contractor.ssnLast4,
          w9SnapshotJson: submission.snapshotJson,
        });

        recipients.push({
          recipientId: contractor.id,
          payerName,
          recipientName: contractor.legalName,
          recipientTinLast4: contractor.ssnLast4 ?? '',
          payments,
          backupWithholdingFlagged: contractor.backupWithholdingFlagged ?? false,
          tinMismatch,
          recordedBackupWithholdingMinor,
          cfsfStateCode: null,
        });
      }

      const result = await generateBatch(
        {
          organizationId: ctx.organizationId,
          payerOrgId: ctx.organizationId,
          taxYear: input.taxYear,
          recipients,
        },
        { db: ctx.db, persist: ctx.db, actorId: ctx.user.id, actorType: 'USER' },
      );

      return {
        taxYear: input.taxYear,
        idempotent: result.idempotent,
        generatedCount: result.generated.length,
        suppressedCount: result.suppressedRecipientIds.length,
      };
    }),

  /**
   * Build the IRIS XML for the tax-year batch and XSD-validate it, returning the
   * validation report (never the raw XML on this path). Until the IRS XSD bundle
   * is placed the report is BUNDLE_UNAVAILABLE (validity unproven) — nothing
   * files on that outcome.
   */
  buildAndValidateXml: usExpansionProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(taxYearInput)
    .query(async ({ ctx, input }) => {
      const assembled = await assembleIrisInput(ctx.db, ctx.organizationId, input.taxYear);
      const result = await createTaxFilingTransmitter('manual').transmit(assembled);

      return {
        taxYear: input.taxYear,
        recipientCount: assembled.rowCount,
        status: result.validation.status,
        ready: result.ready,
        errors: result.validation.errors,
      };
    }),

  /**
   * ManualDownload: build + XSD-validate the IRIS XML and, when valid, return it
   * for the operator to download and upload to IRIS. Records the IrisSubmission
   * once per (org, tax year) via idempotency so a retried download does not
   * create duplicate submission rows. Audited.
   */
  downloadValidatedXml: usExpansionProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(taxYearInput)
    .mutation(async ({ ctx, input }) => {
      const assembled = await assembleIrisInput(ctx.db, ctx.organizationId, input.taxYear);
      const result = await createTaxFilingTransmitter('manual').transmit(assembled);

      if (!(result.ready && result.xml)) {
        return {
          taxYear: input.taxYear,
          ready: false as const,
          status: result.validation.status,
          errors: result.validation.errors,
        };
      }

      const key = `form1099nec:transmit:${ctx.organizationId}:${input.taxYear}`;
      const hit = await reserve<{ submissionId: string }>(key, 24 * 60 * 60);
      let submissionId: string | undefined;
      if (hit.kind === 'HIT') {
        submissionId = hit.result.submissionId;
      } else if (hit.kind === 'MISS') {
        try {
          const submission = await ctx.db.irisSubmission.create({
            data: {
              organizationId: ctx.organizationId,
              taxYear: input.taxYear,
              schemaVersionNum: IRIS_SCHEMA_VERSION.versionNum,
              schemaVersionDt: IRIS_SCHEMA_VERSION.versionDt,
              transmitMethod: 'manual',
            },
            select: { id: true },
          });
          submissionId = submission.id;
          await writeAuditLog({
            organizationId: ctx.organizationId,
            actorType: 'USER',
            actorId: ctx.user.id,
            action: 'form1099.iris.xml_downloaded',
            resourceType: 'ORGANIZATION',
            resourceId: ctx.organizationId,
            metadata: { taxYear: input.taxYear, submissionId, transmitMethod: 'manual' },
          });
          await complete(key, { submissionId }, 24 * 60 * 60);
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
   * Parse an uploaded IRS IRIS acknowledgement file, update the submission's
   * status, and append an immutable IrisAck row with the Error Information Group.
   * The ack file is untrusted — `parseIrisAck` is XXE-safe and never `as`-casts.
   */
  uploadAck: usExpansionProcedure
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
          schemaVersionNum: IRIS_SCHEMA_VERSION.versionNum,
          ...(input.submissionId ? { id: input.submissionId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        select: { id: true },
      });
      if (!submission) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORM_1099_NOT_FOUND });
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
          action: 'form1099.iris.ack_uploaded',
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
   * List the tax-year recipients carrying backup withholding — the advisory
   * TIN-mismatch / W-9-flag population. Amber advisory only: this is a review
   * surface, never a gate on generation.
   */
  listTinMismatches: usExpansionProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(taxYearInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.form1099Nec.findMany({
        where: {
          organizationId: ctx.organizationId,
          taxYear: input.taxYear,
          status: 'ACTIVE',
          recipient: { backupWithholdingFlagged: true },
        },
        select: {
          recipientId: true,
          box1AmountMinor: true,
          box4BackupWithholdingMinor: true,
          recipient: { select: { legalName: true, ssnLast4: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
      });

      return rows.map(r => ({
        recipientId: r.recipientId,
        recipientName: r.recipient.legalName,
        tinLast4: r.recipient.ssnLast4,
        box1AmountMinor: r.box1AmountMinor,
        box4BackupWithholdingMinor: r.box4BackupWithholdingMinor,
      }));
    }),

  /** Escalate a TIN mismatch for admin follow-up (advisory — audit only). */
  escalateMismatch: usExpansionProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z
        .object({
          recipientId: z.string().min(1),
          taxYear: z.number().int().min(2020).max(2100),
          note: z.string().max(1000).optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findFirst({
        where: { id: input.recipientId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!contractor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'form1099.tin_mismatch.escalated',
        resourceType: 'CONTRACTOR',
        resourceId: contractor.id,
        metadata: { taxYear: input.taxYear, note: input.note ?? null },
      });

      return { recipientId: contractor.id, escalated: true };
    }),

  /** Resolve a TIN mismatch (advisory — audit only). */
  resolveMismatch: usExpansionProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z
        .object({
          recipientId: z.string().min(1),
          taxYear: z.number().int().min(2020).max(2100),
          note: z.string().max(1000).optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findFirst({
        where: { id: input.recipientId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!contractor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'form1099.tin_mismatch.resolved',
        resourceType: 'CONTRACTOR',
        resourceId: contractor.id,
        metadata: { taxYear: input.taxYear, note: input.note ?? null },
      });

      return { recipientId: contractor.id, resolved: true };
    }),

  /**
   * File a CORRECTED 1099-NEC: re-derive the figures from the existing row,
   * supersede the prior ACTIVE row, and insert the new ACTIVE row in one audited
   * transaction. The filed row is never mutated in place.
   */
  fileCorrection: usExpansionProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(z.object({ formId: z.string().min(1), reason: z.string().min(1).max(500) }).strict())
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.db.form1099Nec.findFirst({
        where: { id: input.formId, organizationId: ctx.organizationId, status: 'ACTIVE' },
        select: {
          payerOrgId: true,
          recipientId: true,
          taxYear: true,
          box1AmountMinor: true,
          box4BackupWithholdingMinor: true,
          currency: true,
          cfsfStateCode: true,
          recipient: { select: { legalName: true, ssnLast4: true } },
        },
      });
      if (!form) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.FORM_1099_NOT_FOUND });
      }

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true, legalName: true },
      });

      const snapshotJson = buildForm1099NecSnapshot({
        taxYear: form.taxYear,
        payerOrgId: form.payerOrgId,
        recipientId: form.recipientId,
        payerName: org?.legalName ?? org?.name ?? ctx.organizationId,
        recipientName: form.recipient.legalName,
        recipientTinLast4: form.recipient.ssnLast4 ?? '',
        box1AmountMinor: form.box1AmountMinor,
        box4BackupWithholdingMinor: form.box4BackupWithholdingMinor,
        currency: form.currency,
        cfsfStateCode: form.cfsfStateCode,
        corrected: true,
      });

      const created = await ctx.db.$transaction(tx =>
        fileCorrection(tx, {
          organizationId: ctx.organizationId,
          payerOrgId: form.payerOrgId,
          recipientId: form.recipientId,
          taxYear: form.taxYear,
          snapshotJson: snapshotJson as unknown as Prisma.InputJsonValue,
          box1AmountMinor: form.box1AmountMinor,
          box4BackupWithholdingMinor: form.box4BackupWithholdingMinor,
          currency: form.currency,
          cfsfStateCode: form.cfsfStateCode,
          actorId: ctx.user.id,
          actorType: 'USER',
        }),
      );

      return { id: created.id, status: created.status, reason: input.reason };
    }),

  /**
   * Per-state filing output for a tax year + state. A CFSF-participating state is
   * auto-forwarded via the IRIS B-record (no separate file); a non-CFSF /
   * direct-filing state gets a downloadable CSV + manual-portal guidance.
   */
  getStateFilingOutput: usExpansionProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(
      z
        .object({
          taxYear: z.number().int().min(2020).max(2100),
          stateCode: z.string().length(2).toUpperCase(),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      const config = await ctx.db.stateFilingConfig.findUnique({
        where: { stateCode_taxYear: { stateCode: input.stateCode, taxYear: input.taxYear } },
        select: {
          stateCode: true,
          cfsfParticipant: true,
          requiresDirectFiling: true,
          note: true,
        },
      });
      if (!config) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.STATE_FILING_CONFIG_NOT_FOUND });
      }

      const rows = await ctx.db.form1099Nec.findMany({
        where: { organizationId: ctx.organizationId, taxYear: input.taxYear, status: 'ACTIVE' },
        select: {
          recipientId: true,
          box1AmountMinor: true,
          box4BackupWithholdingMinor: true,
          recipient: { select: { legalName: true, ssnLast4: true } },
        },
        take: 5000,
      });

      return buildStateFilingOutput(
        config,
        rows.map(r => ({
          recipientId: r.recipientId,
          recipientName: r.recipient.legalName,
          recipientTinLast4: r.recipient.ssnLast4 ?? '',
          box1AmountMinor: r.box1AmountMinor,
          box4BackupWithholdingMinor: r.box4BackupWithholdingMinor,
        })),
      );
    }),
});
