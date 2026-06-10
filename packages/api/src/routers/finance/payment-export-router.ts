import type { Prisma } from '@contractor-ops/db';
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
import { detectFormat } from '../../services/payment-format-detection';
import {
  _buildExportItems,
  _generateExportFileForFormat,
  _resolveOrgBankInfo,
  log,
  VALID_TRANSITIONS,
} from './payment-shared';

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
                  },
                },
                billingProfile: {
                  select: {
                    bankAccountMasked: true,
                    swiftBic: true,
                    bankName: true,
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
          return {
            run,
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

      const exportItems = _buildExportItems(prepared.run.items, prepared.transferTitleTemplate);
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
      let toctouFailureContext: { contractorIds: string[]; exportDateUtc: string } | null = null;

      let updatedRun: Awaited<ReturnType<typeof ctx.db.paymentRun.update>> | typeof prepared.run;
      try {
        updatedRun = await ctx.db.$transaction(async tx => {
          const current = await tx.paymentRun.findFirst({
            where: { id: prepared.run.id, organizationId: ctx.organizationId },
            select: { status: true },
          });
          if (!current) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: E.PAYMENT_RUN_NOT_FOUND,
            });
          }
          if (current.status === 'EXPORTED' || current.status === 'LOCKED') {
            return prepared.run;
          }

          try {
            await assertContractorPaymentEligibility(distinctContractorIds, {
              tx,
              organizationId: ctx.organizationId,
            });
          } catch (err) {
            if (err instanceof TRPCError && err.code === 'PRECONDITION_FAILED') {
              toctouFailureContext = { contractorIds: distinctContractorIds, exportDateUtc };
            }
            throw err;
          }

          const updated = await tx.paymentRun.update({
            where: { id: prepared.run.id },
            data: {
              status: 'EXPORTED',
              exportFormat: input.exportFormat,
              exportedAt: new Date(),
              totalMinor: prepared.freshTotalMinor,
              invoiceCount: prepared.freshInvoiceCount,
            },
          });

          const exportRow = await tx.paymentExport.create({
            data: {
              organizationId: ctx.organizationId,
              paymentRunId: prepared.run.id,
              format: input.exportFormat,
              status: 'GENERATED',
              generatedByUserId: ctx.user.id,
            },
          });

          for (const contractorId of distinctContractorIds) {
            const snap = await buildSnapshotForContractor(tx, contractorId, exportDateUtc);
            await tx.paymentRunComplianceCheck.create({
              data: {
                organizationId: ctx.organizationId,
                paymentRunId: prepared.run.id,
                paymentExportId: exportRow.id,
                contractorId,
                snapshotJson: snap.snapshotJson as unknown as Prisma.InputJsonValue,
                eligibilityVerdict: 'PASS',
                policyRuleSetVersion: snap.policyRuleSetVersion,
              },
            });
          }

          await writeAuditLog({
            tx,
            organizationId: ctx.organizationId,
            actorType: 'USER',
            actorId: ctx.user.id,
            action: 'payment_run.lock_and_export',
            resourceType: 'PAYMENT_RUN',
            resourceId: prepared.run.id,
            resourceName: prepared.run.runNumber ?? prepared.run.id,
            oldValues: { status: prepared.run.status },
            newValues: {
              status: 'EXPORTED',
              exportFormat: input.exportFormat,
              totalMinor: prepared.freshTotalMinor,
              invoiceCount: prepared.freshInvoiceCount,
            },
          });

          return updated;
        });
      } catch (err) {
        if (toctouFailureContext) {
          const failCtx = toctouFailureContext as {
            contractorIds: string[];
            exportDateUtc: string;
          };
          try {
            await ctx.db.$transaction(async tx2 => {
              for (const contractorId of failCtx.contractorIds) {
                const snap = await buildSnapshotForContractor(
                  tx2,
                  contractorId,
                  failCtx.exportDateUtc,
                );
                if (snap.eligibilityVerdict !== 'FAIL') continue;
                await tx2.paymentRunComplianceCheck.create({
                  data: {
                    organizationId: ctx.organizationId,
                    paymentRunId: input.runId,
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
              { err: writeErr, runId: input.runId },
              'payment.lockAndExport FAIL-verdict separate-tx write failed (non-blocking)',
            );
          }
        }
        throw err;
      }

      return {
        run: updatedRun,
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
                    select: { bankAccountMasked: true },
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
        const iban = item.contractor?.billingProfiles[0]?.bankAccountMasked ?? '';
        const format = detectFormat(currency, iban);

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
