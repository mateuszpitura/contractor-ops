import type { Prisma } from '@contractor-ops/db';
import type { PaymentRunLock } from '@contractor-ops/validators';
import { paymentRunLockSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { assertContractorPaymentEligibility } from '../../services/compliance-payment-gate';
import { buildSnapshotForContractor } from '../../services/payment-export-compliance-snapshot';
import { detectFormatForDestination } from '../../services/payment-format-detection';
import type { DbClient } from '../../services/types';
import type { TxClient } from './payment-shared';
import {
  _buildExportItems,
  _generateExportFileForFormat,
  _resolveOrgBankInfo,
  assertExportItemsMatchRequestedFormat,
  log,
  persistExportSettlements,
  VALID_TRANSITIONS,
} from './payment-shared';

/**
 * Writes the `PaymentExport` row, the per-contractor PASS `PaymentRunComplianceCheck`
 * snapshots, and the lock-and-export audit entry. Called only after the atomic
 * DRAFT/LOCKED → EXPORTED transition has won, so these rows are created exactly
 * once per export.
 */
async function writeExportAndComplianceRows(
  tx: TxClient,
  params: {
    organizationId: string;
    userId: string;
    run: { id: string; runNumber: string | null; status: string };
    exportFormat: PaymentRunLock['exportFormat'];
    contractorIds: string[];
    exportDateUtc: string;
    totalMinor: number;
    invoiceCount: number;
  },
): Promise<void> {
  const exportRow = await tx.paymentExport.create({
    data: {
      organizationId: params.organizationId,
      paymentRunId: params.run.id,
      format: params.exportFormat,
      status: 'GENERATED',
      generatedByUserId: params.userId,
    },
  });

  for (const contractorId of params.contractorIds) {
    const snap = await buildSnapshotForContractor(tx, contractorId, params.exportDateUtc);
    await tx.paymentRunComplianceCheck.create({
      data: {
        organizationId: params.organizationId,
        paymentRunId: params.run.id,
        paymentExportId: exportRow.id,
        contractorId,
        snapshotJson: snap.snapshotJson as unknown as Prisma.InputJsonValue,
        eligibilityVerdict: snap.eligibilityVerdict,
        policyRuleSetVersion: snap.policyRuleSetVersion,
      },
    });
  }

  await writeAuditLog({
    tx,
    organizationId: params.organizationId,
    actorType: 'USER',
    actorId: params.userId,
    action: 'payment_run.lock_and_export',
    resourceType: 'PAYMENT_RUN',
    resourceId: params.run.id,
    resourceName: params.run.runNumber ?? params.run.id,
    oldValues: { status: params.run.status },
    newValues: {
      status: 'EXPORTED',
      exportFormat: params.exportFormat,
      totalMinor: params.totalMinor,
      invoiceCount: params.invoiceCount,
    },
  });
}

interface ExportTransactionParams {
  organizationId: string;
  userId: string;
  run: { id: string; runNumber: string | null; status: string };
  exportFormat: PaymentRunLock['exportFormat'];
  contractorIds: string[];
  exportDateUtc: string;
  totalMinor: number;
  invoiceCount: number;
}

/**
 * The export transaction body: re-verify eligibility, perform the atomic
 * DRAFT/LOCKED → EXPORTED transition, and (only on the winning transition)
 * write the export + compliance rows. Signals whether THIS call won the
 * transition (`exported: true`) or lost the race to a concurrent caller that
 * already advanced the run (`exported: false`). The caller must not return a
 * bank file for a loser — the file buffer is built before the transition, so a
 * lost race would otherwise hand out a second copy of the same payment file.
 */
async function runExportTransaction(tx: TxClient, params: ExportTransactionParams) {
  await assertContractorPaymentEligibility(params.contractorIds, {
    tx,
    organizationId: params.organizationId,
  });

  // Atomic DRAFT/LOCKED → EXPORTED transition. Guarding the status in the
  // `where` makes the check-and-set a single statement, so two concurrent
  // calls cannot both observe a pre-export status and both create
  // export/compliance rows: the loser's `updateMany` matches zero rows.
  const transition = await tx.paymentRun.updateMany({
    where: {
      id: params.run.id,
      organizationId: params.organizationId,
      status: { in: ['DRAFT', 'LOCKED'] },
    },
    data: {
      status: 'EXPORTED',
      exportFormat: params.exportFormat,
      exportedAt: new Date(),
      totalMinor: params.totalMinor,
      invoiceCount: params.invoiceCount,
    },
  });

  if (transition.count !== 1) {
    // Another caller (or a prior call) already advanced the run past the
    // pre-export state — treat as idempotent and skip row creation.
    const current = await tx.paymentRun.findFirst({
      where: { id: params.run.id, organizationId: params.organizationId },
    });
    if (!current) {
      throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });
    }
    return { run: current, exported: false as const };
  }

  const updated = await tx.paymentRun.findFirstOrThrow({
    where: { id: params.run.id, organizationId: params.organizationId },
  });

  await writeExportAndComplianceRows(tx, params);

  return { run: updated, exported: true as const };
}

/**
 * Best-effort, non-blocking record of FAIL eligibility snapshots after a blocked
 * export. Runs in its own transaction; swallows write errors (logs them) so the
 * original PRECONDITION_FAILED still surfaces to the caller.
 */
async function writeFailVerdictSnapshots(
  db: DbClient,
  params: {
    organizationId: string;
    runId: string;
    contractorIds: string[];
    exportDateUtc: string;
  },
): Promise<void> {
  try {
    await db.$transaction(async tx => {
      for (const contractorId of params.contractorIds) {
        const snap = await buildSnapshotForContractor(tx, contractorId, params.exportDateUtc);
        if (snap.eligibilityVerdict !== 'FAIL') continue;
        await tx.paymentRunComplianceCheck.create({
          data: {
            organizationId: params.organizationId,
            paymentRunId: params.runId,
            paymentExportId: null,
            contractorId,
            snapshotJson: snap.snapshotJson as unknown as Prisma.InputJsonValue,
            eligibilityVerdict: 'FAIL',
            failureReasons: snap.failureReasons as unknown as Prisma.InputJsonValue,
            policyRuleSetVersion: snap.policyRuleSetVersion,
          },
        });
      }
    });
  } catch (writeErr) {
    log.error(
      { err: writeErr, runId: params.runId },
      'payment.lockAndExport FAIL-verdict separate-tx write failed (non-blocking)',
    );
  }
}

export const paymentExportRouter = router({
  lockAndExport: tenantProcedure
    .use(requirePermission({ payment: ['export'] }))
    .input(paymentRunLockSchema)
    .mutation(async ({ ctx, input }) => {
      const prepared = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: {
            items: {
              include: {
                invoice: {
                  select: {
                    invoiceNumber: true,
                    dueDate: true,
                    servicePeriodStart: true,
                    servicePeriodEnd: true,
                  },
                },
                contractor: {
                  select: {
                    legalName: true,
                    taxId: true,
                    currency: true,
                  },
                },
                billingProfile: {
                  select: {
                    bankAccountMasked: true,
                    bankAccountEncrypted: true,
                    swiftBic: true,
                    bankName: true,
                    usRoutingNumberEncrypted: true,
                    usAccountNumberEncrypted: true,
                  },
                },
              },
            },
          },
        });

        if (!run) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        if (run.status === 'LOCKED' || run.status === 'EXPORTED') {
          // `run` above is include-loaded with billing-profile ciphertext
          // (bankAccountEncrypted/us*Encrypted) + contractor.taxId for the file
          // builder. Re-select the bare run (the same shape the race-loser /
          // winner paths return) so the idempotent replay leaks no ciphertext.
          const safeRun = await tx.paymentRun.findFirstOrThrow({
            where: { id: run.id, organizationId: ctx.organizationId },
          });
          return {
            run: safeRun,
            idempotent: true as const,
          };
        }

        if (
          !(
            VALID_TRANSITIONS[run.status]?.includes('LOCKED') ||
            VALID_TRANSITIONS[run.status]?.includes('EXPORTED')
          )
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.PAYMENT_RUN_INVALID_STATUS,
          });
        }

        const itemCurrencies = await tx.paymentRunItem.findMany({
          where: { paymentRunId: run.id, status: { not: 'SKIPPED' } },
          select: { currency: true },
          distinct: ['currency'],
        });

        const mismatchedCurrencies = itemCurrencies.filter(item => item.currency !== run.currency);

        if (mismatchedCurrencies.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.PAYMENT_MIXED_CURRENCIES,
          });
        }

        const itemsAgg = await tx.paymentRunItem.aggregate({
          where: { paymentRunId: run.id, status: { not: 'SKIPPED' } },
          _sum: { amountMinor: true },
          _count: true,
        });

        const { orgBank, transferTitleTemplate } = await _resolveOrgBankInfo(
          tx,
          ctx.organizationId,
        );

        return {
          run,
          idempotent: false as const,
          freshTotalMinor: itemsAgg._sum.amountMinor ?? 0,
          freshInvoiceCount: itemsAgg._count,
          orgBank,
          transferTitleTemplate,
        };
      });

      if (prepared.idempotent) {
        return {
          run: prepared.run,
          fileBase64: null,
          fileName: null,
          idempotent: true,
        };
      }

      // Settle each item at the export (payment) date before the file is built,
      // so the exported amount/currency is the settled value, not the raw run
      // amount. The per-run settlement-currency override is threaded by the
      // programmatic payout path; the file export defaults to the contractor's
      // currency.
      const { items: exportItems, settlements } = await _buildExportItems(
        ctx.db,
        prepared.run.items,
        prepared.transferTitleTemplate,
        { paymentDate: new Date() },
      );
      assertExportItemsMatchRequestedFormat(input.exportFormat, exportItems);
      const { fileBuffer, ext } = await _generateExportFileForFormat(
        input.exportFormat,
        exportItems,
        prepared.orgBank,
        prepared.run.runNumber ?? prepared.run.id,
      );

      const distinctContractorIds = Array.from(
        new Set(prepared.run.items.map(i => i.contractorId).filter((x): x is string => Boolean(x))),
      );
      const exportDateUtc = new Date().toISOString().slice(0, 10);

      let exportResult: Awaited<ReturnType<typeof runExportTransaction>>;
      try {
        exportResult = await ctx.db.$transaction(tx =>
          runExportTransaction(tx, {
            organizationId: ctx.organizationId,
            userId: ctx.user.id,
            run: prepared.run,
            exportFormat: input.exportFormat,
            contractorIds: distinctContractorIds,
            exportDateUtc,
            totalMinor: prepared.freshTotalMinor,
            invoiceCount: prepared.freshInvoiceCount,
          }),
        );
      } catch (err) {
        // A blocked-eligibility verdict surfaced mid-transition (TOCTOU): record
        // the FAIL snapshots in a separate, best-effort transaction so the audit
        // trail captures why the export was refused. Non-blocking — the original
        // error is always rethrown.
        if (err instanceof TRPCError && err.code === 'PRECONDITION_FAILED') {
          await writeFailVerdictSnapshots(ctx.db, {
            organizationId: ctx.organizationId,
            runId: input.runId,
            contractorIds: distinctContractorIds,
            exportDateUtc,
          });
        }
        throw err;
      }

      // The bank file was built before the transition (it has to exist for the
      // winner), but only the caller that actually flipped the run to EXPORTED may
      // return it. A race loser returns a null file with the idempotent flag so an
      // operator never receives a second copy of an already-exported payment file.
      // The loser also skips the settlement-provenance write: those FX rates were
      // computed while building the (discarded) file, and the winner persists them.
      if (!exportResult.exported) {
        return {
          run: exportResult.run,
          fileBase64: null,
          fileName: null,
          idempotent: true,
        };
      }

      await persistExportSettlements(ctx.db, settlements);

      return {
        run: exportResult.run,
        fileBase64: fileBuffer.toString('base64'),
        fileName: `${prepared.run.runNumber ?? prepared.run.id}.${ext}`,
      };
    }),

  getFormatDetection: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(z.object({ paymentRunId: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.paymentRun.findFirst({
        where: {
          id: input.paymentRunId,
          organizationId: ctx.organizationId,
        },
        include: {
          items: {
            include: {
              invoice: {
                select: { currency: true },
              },
              contractor: {
                include: {
                  billingProfiles: {
                    take: 1,
                    select: {
                      bankAccountMasked: true,
                      usRoutingNumberEncrypted: true,
                      usAccountNumberEncrypted: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.PAYMENT_RUN_NOT_FOUND,
        });
      }

      const detections = run.items.map(item => {
        const currency = item.invoice?.currency ?? run.currency;
        const profile = item.contractor?.billingProfiles[0];
        const iban = profile?.bankAccountMasked ?? '';

        // Presence-only US signal: the advisory picks the US rail from the mere
        // existence of the encrypted routing/account, so the ciphertext is
        // reduced to a sentinel before it reaches the routing object — it is
        // never decrypted, logged, or returned in the response.
        const format = detectFormatForDestination(
          currency,
          {
            iban: iban || null,
            ukSortCodeEncrypted: null,
            ukAccountNumberEncrypted: null,
            usRoutingNumberEncrypted: profile?.usRoutingNumberEncrypted ? 'present' : null,
            usAccountNumberEncrypted: profile?.usAccountNumberEncrypted ? 'present' : null,
          },
          { amountMinor: item.amountMinor },
        );

        return {
          paymentRunItemId: item.id,
          contractorId: item.contractorId,
          currency,
          iban,
          format,
        };
      });

      return detections;
    }),
});
