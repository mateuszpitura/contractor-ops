import { prisma } from "@contractor-ops/db";
import {
  reminderRuleCreateSchema,
  reminderRuleToggleSchema,
  reminderRuleUpdateSchema,
} from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as E from "../errors.js";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Reminder router
// ---------------------------------------------------------------------------

export const reminderRouter = router({
  /**
   * List all reminder rules for the organization.
   * Available to all tenant members.
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    const rules = await prisma.reminderRule.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
    });

    return plain(rules);
  }),

  /**
   * Create a new reminder rule. Admin only.
   */
  create: tenantProcedure
    .use(requirePermission({ organization: ["update"] }))
    .input(reminderRuleCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const rule = await prisma.reminderRule.create({
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

      return plain(rule);
    }),

  /**
   * Update an existing reminder rule. Admin only.
   */
  update: tenantProcedure
    .use(requirePermission({ organization: ["update"] }))
    .input(z.object({ id: z.string() }).merge(reminderRuleUpdateSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await prisma.reminderRule.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.REMINDER_RULE_NOT_FOUND,
        });
      }

      const updated = await prisma.reminderRule.update({
        where: { id },
        data: {
          ...data,
          configJson: data.configJson ? JSON.parse(JSON.stringify(data.configJson)) : undefined,
        },
      });

      return plain(updated);
    }),

  /**
   * Delete a reminder rule and its related instances. Admin only.
   */
  delete: tenantProcedure
    .use(requirePermission({ organization: ["update"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.reminderRule.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.REMINDER_RULE_NOT_FOUND,
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.reminderInstance.deleteMany({
          where: {
            reminderRuleId: input.id,
            organizationId: ctx.organizationId,
          },
        });

        await tx.reminderRule.delete({ where: { id: input.id } });
      });

      return { success: true };
    }),

  /**
   * Toggle a reminder rule's active status.
   * When deactivating, cancels all pending reminder instances.
   * Admin only.
   */
  toggleActive: tenantProcedure
    .use(requirePermission({ organization: ["update"] }))
    .input(reminderRuleToggleSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.reminderRule.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.REMINDER_RULE_NOT_FOUND,
        });
      }

      await prisma.$transaction(async (tx) => {
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
              status: "PENDING",
            },
            data: { status: "CANCELLED" },
          });
        }
      });

      return { success: true };
    }),
});
