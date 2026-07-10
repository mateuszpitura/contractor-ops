/**
 * Invoice action procedures (void, reverse charge toggle).
 */

import { entityIdSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { deleteCalendarEvent } from '../../services/calendar-event-service';

export const invoiceActionsRouter = router({
  /**
   * Void an invoice (soft status transition to VOID).
   */
  voidInvoice: tenantProcedure
    .use(requirePermission({ invoice: ['delete'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

      if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'IN_RUN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.INVOICE_VOID_NOT_ALLOWED,
        });
      }

      const updated = await ctx.db.$transaction(async tx => {
        const result = await tx.invoice.updateMany({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            deletedAt: null,
            status: { not: 'VOID' },
            paymentStatus: { notIn: ['PAID', 'IN_RUN'] },
          },
          data: {
            status: 'VOID',
            paymentStatus: 'NOT_READY',
            approvalStatus: 'CANCELLED',
            paidAt: null,
            readyForPaymentAt: null,
            approvedAt: null,
          },
        });

        if (result.count === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.INVOICE_VOID_NOT_ALLOWED,
          });
        }

        await tx.approvalStep.updateMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ['NOT_STARTED', 'PENDING'] },
            approvalFlow: {
              resourceType: 'INVOICE',
              resourceId: input.id,
            },
          },
          data: {
            status: 'CANCELLED',
            actedAt: new Date(),
          },
        });

        await tx.approvalFlow.updateMany({
          where: {
            organizationId: ctx.organizationId,
            resourceType: 'INVOICE',
            resourceId: input.id,
            status: { in: ['NOT_STARTED', 'PENDING', 'PENDING_COMPLIANCE'] },
          },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
            cancelledAt: new Date(),
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'invoice.void',
          resourceType: 'INVOICE',
          resourceId: input.id,
          resourceName: invoice.invoiceNumber,
          oldValues: {
            status: invoice.status,
            paymentStatus: invoice.paymentStatus,
            approvalStatus: invoice.approvalStatus,
          },
          newValues: {
            status: 'VOID',
            paymentStatus: 'NOT_READY',
            approvalStatus: 'CANCELLED',
          },
        });

        return tx.invoice.findFirstOrThrow({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        });
      });

      // Calendar cleanup: remove payment deadline event
      void deleteCalendarEvent(ctx.db, {
        organizationId: ctx.organizationId,
        entityType: 'INVOICE',
        entityId: input.id,
      }).catch(_err => {
        /* fire-and-forget */
      });

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return updated;
    }),

  /**
   * Toggle reverse charge status on an invoice.
   * Records the override so audit trail distinguishes auto-detected from manual.
   */
  toggleReverseCharge: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z.object({
        invoiceId: z.string(),
        isReverseCharge: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.invoice.findFirst({
        where: {
          id: input.invoiceId,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          paymentStatus: true,
          isReverseCharge: true,
          reverseChargeOverride: true,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

      if (
        existing.status === 'VOID' ||
        existing.paymentStatus === 'PAID' ||
        existing.paymentStatus === 'IN_RUN'
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.INVOICE_VOID_NOT_ALLOWED,
        });
      }

      const invoice = await ctx.db.$transaction(async tx => {
        const updated = await tx.invoice.update({
          where: {
            id: input.invoiceId,
            organizationId: ctx.organizationId,
          },
          data: {
            isReverseCharge: input.isReverseCharge,
            reverseChargeOverride: input.isReverseCharge,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'invoice.reverse-charge.toggle',
          resourceType: 'INVOICE',
          resourceId: existing.id,
          resourceName: existing.invoiceNumber,
          oldValues: {
            isReverseCharge: existing.isReverseCharge,
            reverseChargeOverride: existing.reverseChargeOverride,
          },
          newValues: {
            isReverseCharge: input.isReverseCharge,
            reverseChargeOverride: input.isReverseCharge,
          },
        });

        return updated;
      });
      return invoice;
    }),
});
