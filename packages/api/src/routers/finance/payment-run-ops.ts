import {
  markAllPaidSchema,
  paymentRunCancelSchema,
  paymentRunItemStatusSchema,
  removeFromRunSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { enqueueHrisEmployeePush } from '../../services/outbox/hris-push-producer';
import { autoCompleteRunIfTerminal, VALID_TRANSITIONS } from './payment-shared';

export const paymentRunOpsRouter = router({
  updateItemStatus: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(paymentRunItemStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const item = await tx.paymentRunItem.findFirst({
          where: {
            id: input.itemId,
            organizationId: ctx.organizationId,
          },
          include: { paymentRun: true },
        });

        if (!item) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_ITEM_NOT_FOUND,
          });
        }

        const updatedItem = await tx.paymentRunItem.update({
          where: { id: item.id },
          data: {
            status: input.status,
            paymentReference: input.paymentReference ?? null,
            failureReason: input.status === 'FAILED' ? input.failureReason : null,
            markedPaidAt: input.status === 'PAID' ? new Date() : null,
          },
        });

        if (input.status === 'PAID') {
          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: 'PAID', paidAt: new Date() },
          });
        } else if (input.status === 'FAILED') {
          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: 'READY' },
          });
        }

        // Push the business event to a connected HRIS iff this invoice belongs
        // to an EMPLOYEE worker (contractor payments never push). The helper is
        // a no-op for contractors; it only enqueues an outbox row that the drain
        // dispatches — the adapter is never called inline.
        if (input.status === 'PAID' || input.status === 'FAILED') {
          const invoice = await tx.invoice.findUnique({
            where: { id: item.invoiceId },
            select: {
              currency: true,
              totalMinor: true,
              contractor: { select: { workerId: true } },
            },
          });
          const workerId = invoice?.contractor?.workerId;
          if (workerId) {
            const occurredAt = new Date().toISOString();
            if (input.status === 'PAID') {
              await enqueueHrisEmployeePush(tx, {
                organizationId: ctx.organizationId,
                workerId,
                eventType: 'hris.invoice-paid.push',
                payload: {
                  workerId,
                  invoiceId: item.invoiceId,
                  paidAt: occurredAt,
                  amount: String(invoice?.totalMinor ?? 0),
                  currency: invoice?.currency ?? '',
                },
                businessEventId: updatedItem.id,
              });
            }
            await enqueueHrisEmployeePush(tx, {
              organizationId: ctx.organizationId,
              workerId,
              eventType: 'hris.payment-status.push',
              payload: {
                workerId,
                paymentId: updatedItem.id,
                status: input.status,
                occurredAt,
              },
              businessEventId: updatedItem.id,
            });
          }
        }

        await autoCompleteRunIfTerminal(tx, item.paymentRunId);

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'payment_run.item_status_update',
          resourceType: 'PAYMENT_RUN',
          resourceId: item.paymentRunId,
          oldValues: { itemStatus: item.status },
          newValues: {
            itemId: updatedItem.id,
            itemStatus: updatedItem.status,
            invoiceId: item.invoiceId,
            paymentReference: updatedItem.paymentReference,
            failureReason: updatedItem.failureReason,
          },
        });

        return updatedItem;
      });

      return result;
    }),

  markAllPaid: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(markAllPaidSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: {
            items: {
              where: { status: { in: ['PENDING', 'EXPORTED'] } },
            },
          },
        });

        if (!run) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        const now = new Date();
        const itemIds = run.items.map(i => i.id);
        const invoiceIds = run.items.map(i => i.invoiceId);

        await tx.paymentRunItem.updateMany({
          where: { id: { in: itemIds } },
          data: {
            status: 'PAID',
            paymentReference: input.batchReference ?? null,
            markedPaidAt: now,
          },
        });

        await tx.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: { paymentStatus: 'PAID', paidAt: now },
        });

        const updatedRun = await tx.paymentRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'payment_run.mark_all_paid',
          resourceType: 'PAYMENT_RUN',
          resourceId: run.id,
          resourceName: run.runNumber,
          oldValues: { status: run.status },
          newValues: {
            status: 'COMPLETED',
            itemCount: itemIds.length,
            invoiceIds,
            batchReference: input.batchReference ?? null,
          },
        });

        return updatedRun;
      });

      return result;
    }),

  cancel: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(paymentRunCancelSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: { items: true },
        });

        if (!run) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        if (!VALID_TRANSITIONS[run.status]?.includes('CANCELLED')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.PAYMENT_RUN_INVALID_STATUS,
          });
        }

        if (run.status === 'EXPORTED') {
          const member = await tx.member.findFirst({
            where: {
              organizationId: ctx.organizationId,
              userId: ctx.user.id,
            },
            select: { role: true },
          });

          if (member?.role !== 'admin') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: E.PAYMENT_RUN_CANCEL_ADMIN_ONLY,
            });
          }
        }

        const unpaidInvoiceIds = run.items
          .filter(item => item.status !== 'PAID')
          .map(item => item.invoiceId);

        if (unpaidInvoiceIds.length > 0) {
          await tx.invoice.updateMany({
            where: { id: { in: unpaidInvoiceIds } },
            data: { paymentStatus: 'READY' },
          });
        }

        const updatedRun = await tx.paymentRun.update({
          where: { id: run.id },
          data: { status: 'CANCELLED' },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'payment_run.cancel',
          resourceType: 'PAYMENT_RUN',
          resourceId: run.id,
          resourceName: run.runNumber,
          oldValues: { status: run.status },
          newValues: {
            status: 'CANCELLED',
            releasedInvoiceIds: unpaidInvoiceIds,
          },
        });

        return updatedRun;
      });

      return result;
    }),

  removeFromRun: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(removeFromRunSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(
        async tx => {
          const run = await tx.paymentRun.findFirst({
            where: {
              id: input.runId,
              organizationId: ctx.organizationId,
            },
          });

          if (!run) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: E.PAYMENT_RUN_NOT_FOUND,
            });
          }

          if (run.status !== 'DRAFT') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: E.PAYMENT_RUN_NOT_DRAFT,
            });
          }

          const item = await tx.paymentRunItem.findFirst({
            where: {
              paymentRunId: run.id,
              invoiceId: input.invoiceId,
              organizationId: ctx.organizationId,
            },
          });

          if (!item) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: E.PAYMENT_INVOICE_NOT_IN_RUN,
            });
          }

          await tx.paymentRunItem.delete({
            where: { id: item.id },
          });

          await tx.invoice.update({
            where: { id: input.invoiceId },
            data: { paymentStatus: 'READY' },
          });

          const remainingAgg = await tx.paymentRunItem.aggregate({
            where: { paymentRunId: run.id, status: { not: 'SKIPPED' } },
            _sum: { amountMinor: true },
            _count: true,
          });

          const newTotalMinor = remainingAgg._sum.amountMinor ?? 0;
          const newInvoiceCount = remainingAgg._count;

          if (newInvoiceCount === 0) {
            const cancelledRun = await tx.paymentRun.update({
              where: { id: run.id },
              data: {
                totalMinor: 0,
                invoiceCount: 0,
                status: 'CANCELLED',
              },
            });
            await writeAuditLog({
              tx,
              organizationId: ctx.organizationId,
              actorType: 'USER',
              actorId: ctx.user.id,
              action: 'payment_run.remove_item',
              resourceType: 'PAYMENT_RUN',
              resourceId: run.id,
              resourceName: run.runNumber,
              metadata: { removedInvoiceId: input.invoiceId, autoCancelled: true },
              newValues: { status: 'CANCELLED', totalMinor: 0, invoiceCount: 0 },
            });
            return cancelledRun;
          }

          const updatedRun = await tx.paymentRun.update({
            where: { id: run.id },
            data: {
              totalMinor: newTotalMinor,
              invoiceCount: newInvoiceCount,
            },
          });
          await writeAuditLog({
            tx,
            organizationId: ctx.organizationId,
            actorType: 'USER',
            actorId: ctx.user.id,
            action: 'payment_run.remove_item',
            resourceType: 'PAYMENT_RUN',
            resourceId: run.id,
            resourceName: run.runNumber,
            metadata: { removedInvoiceId: input.invoiceId },
            newValues: { totalMinor: newTotalMinor, invoiceCount: newInvoiceCount },
          });
          return updatedRun;
        },
        { isolationLevel: 'Serializable' },
      );

      return result;
    }),
});
