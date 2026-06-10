import {
  entityIdSchema,
  reminderRuleCreateSchema,
  reminderRuleToggleSchema,
  reminderRuleUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reminder router
// ---------------------------------------------------------------------------

export const reminderRouter = router({
  /**
   * List all reminder rules for the organization.
   * Available to all tenant members.
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    const rules = await ctx.db.reminderRule.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return rules;
  }),

  /**
   * Create a new reminder rule. Admin only.
   */
  create: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(reminderRuleCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.db.reminderRule.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          entityType: input.entityType,
          triggerType: input.triggerType,
          offsetDays: input.offsetDays ?? null,
          offsetHours: input.offsetHours ?? null,
          channel: input.channel,
          recipientMode: input.recipientMode,
          configJson: input.configJson ? JSON.parse(JSON.stringify(input.configJson)) : undefined,
          active: input.active,
        },
      });

      // F-OBS-05 — reminder rules drive automated outbound notifications;
      // changes affect customer-facing communications.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'REMINDER_RULE_CREATE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: {
          ruleId: rule.id,
          name: rule.name,
          entityType: rule.entityType,
          triggerType: rule.triggerType,
          channel: rule.channel,
          active: rule.active,
        },
        metadata: { ruleId: rule.id },
      });

      return rule;
    }),

  /**
   * Update an existing reminder rule. Admin only.
   */
  update: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(entityIdSchema.merge(reminderRuleUpdateSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.db.reminderRule.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.REMINDER_RULE_NOT_FOUND,
        });
      }

      const updated = await ctx.db.reminderRule.update({
        where: { id },
        data: {
          ...data,
          configJson: data.configJson ? JSON.parse(JSON.stringify(data.configJson)) : undefined,
        },
      });

      // F-OBS-05 — rule edits change which contractors get notified + when.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'REMINDER_RULE_UPDATE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        oldValues: {
          name: existing.name,
          active: existing.active,
          channel: existing.channel,
          triggerType: existing.triggerType,
        },
        newValues: {
          name: updated.name,
          active: updated.active,
          channel: updated.channel,
          triggerType: updated.triggerType,
        },
        metadata: { ruleId: updated.id },
      });

      return updated;
    }),

  /**
   * Delete a reminder rule and its related instances. Admin only.
   */
  delete: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.reminderRule.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.REMINDER_RULE_NOT_FOUND,
        });
      }

      await ctx.db.$transaction(async tx => {
        await tx.reminderInstance.deleteMany({
          where: {
            reminderRuleId: input.id,
            organizationId: ctx.organizationId,
          },
        });

        await tx.reminderRule.delete({ where: { id: input.id } });
      });

      // F-OBS-05 — rule deletion silences future notifications; auditable.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'REMINDER_RULE_DELETE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        oldValues: {
          ruleId: existing.id,
          name: existing.name,
          entityType: existing.entityType,
          triggerType: existing.triggerType,
          channel: existing.channel,
        },
        metadata: { ruleId: existing.id },
      });

      return { success: true };
    }),

  /**
   * Toggle a reminder rule's active status.
   * When deactivating, cancels all pending reminder instances.
   * Admin only.
   */
  toggleActive: tenantProcedure
    .use(requirePermission({ organization: ['update'] }))
    .input(reminderRuleToggleSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.reminderRule.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.REMINDER_RULE_NOT_FOUND,
        });
      }

      await ctx.db.$transaction(async tx => {
        await tx.reminderRule.update({
          where: { id: input.id },
          data: { active: input.active },
        });

        // If deactivating, cancel pending instances
        if (!input.active) {
          await tx.reminderInstance.updateMany({
            where: {
              reminderRuleId: input.id,
              organizationId: ctx.organizationId,
              status: 'PENDING',
            },
            data: { status: 'CANCELLED' },
          });
        }
      });

      return { success: true };
    }),
});
