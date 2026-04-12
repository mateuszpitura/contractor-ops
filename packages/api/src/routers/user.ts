import { auth } from "@contractor-ops/auth";
import { prisma } from "@contractor-ops/db";
import { inviteUserSchema, updateUserRoleSchema } from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { sensitiveActionProcedure } from "../middleware/sensitive.js";
import { tenantProcedure } from "../middleware/tenant.js";

export const userRouter = router({
  /**
   * List all members of the current organization.
   * Returns user details including name, email, role, and status.
   */
  list: tenantProcedure.use(requirePermission({ member: ["read"] })).query(async ({ ctx }) => {
    const org = await auth.api.getFullOrganization({
      headers: ctx.headers,
      query: { organizationId: ctx.organizationId },
    });

    // Flatten nested user object so frontend gets a consistent shape:
    // { id, userId, name, email, image, role, createdAt }
    return (org?.members ?? []).map((member: Record<string, unknown>) => {
      const user = (member.user ?? {}) as Record<string, unknown>;
      return {
        id: member.id,
        userId: member.userId ?? user.id,
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
        role: member.role ?? null,
        createdAt: member.createdAt ?? null,
      };
    });
  }),

  /**
   * Invite a new user to the organization.
   * Sends an invitation email with a link to accept.
   */
  invite: tenantProcedure
    .use(requirePermission({ member: ["create"] }))
    .input(inviteUserSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await auth.api.createInvitation({
        headers: ctx.headers,
        body: {
          email: input.email,
          role: input.role,
          organizationId: ctx.organizationId,
        },
      });

      return result;
    }),

  /**
   * Update a member's role in the organization.
   * Sensitive action: requires re-authentication if session > 5 minutes old.
   */
  updateRole: sensitiveActionProcedure
    .use(requirePermission({ member: ["update"] }))
    .input(updateUserRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await auth.api.updateMemberRole({
        headers: ctx.headers,
        body: {
          memberId: input.userId,
          role: input.role,
          organizationId: ctx.organizationId,
        },
      });

      return result;
    }),

  /**
   * Deactivate a user by banning them via Better Auth admin plugin.
   * Immediately invalidates all sessions for the user.
   * Sensitive action: requires re-authentication.
   */
  deactivate: sensitiveActionProcedure
    .use(requirePermission({ member: ["delete"] }))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Prevent deactivating the last admin/owner in the organization
      const targetMember = await prisma.member.findFirst({
        where: {
          organizationId: ctx.organizationId,
          userId: input.userId,
        },
        select: { role: true },
      });

      if (targetMember && (targetMember.role === "owner" || targetMember.role === "admin")) {
        const adminCount = await prisma.member.count({
          where: {
            organizationId: ctx.organizationId,
            role: { in: ["owner", "admin"] },
            user: { banned: { not: true } },
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "LAST_ADMIN_CANNOT_DEACTIVATE",
          });
        }
      }

      const result = await auth.api.banUser({
        headers: ctx.headers,
        body: { userId: input.userId },
      });

      // Reassign pending approval steps from deactivated user to another
      // eligible user with the same role, or clear the assignment so the
      // step can be picked up by any user with the matching role.
      const pendingSteps = await prisma.approvalStep.findMany({
        where: {
          organizationId: ctx.organizationId,
          approverUserId: input.userId,
          status: { in: ["NOT_STARTED", "PENDING"] },
        },
        select: { id: true, approverRole: true },
      });

      if (pendingSteps.length > 0) {
        for (const step of pendingSteps) {
          // Try to find a replacement with the same role
          let replacementUserId: string | null = null;

          if (step.approverRole) {
            const replacement = await prisma.member.findFirst({
              where: {
                organizationId: ctx.organizationId,
                role: step.approverRole,
                userId: { not: input.userId },
                user: { banned: { not: true } },
              },
              select: { userId: true },
            });
            replacementUserId = replacement?.userId ?? null;
          }

          await prisma.approvalStep.update({
            where: { id: step.id },
            data: { approverUserId: replacementUserId },
          });
        }
      }

      // Transfer contractor ownership from deactivated user to an admin
      const ownedContractors = await prisma.contractor.findMany({
        where: {
          organizationId: ctx.organizationId,
          ownerUserId: input.userId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (ownedContractors.length > 0) {
        // Find a replacement admin (prefer owner, then admin role)
        const replacement = await prisma.member.findFirst({
          where: {
            organizationId: ctx.organizationId,
            role: { in: ["owner", "admin"] },
            userId: { not: input.userId },
            user: { banned: { not: true } },
          },
          select: { userId: true },
        });

        if (replacement) {
          await prisma.contractor.updateMany({
            where: {
              id: { in: ownedContractors.map((c) => c.id) },
            },
            data: { ownerUserId: replacement.userId },
          });
        } else {
          // No admin available — clear ownership to prevent dangling reference
          await prisma.contractor.updateMany({
            where: {
              id: { in: ownedContractors.map((c) => c.id) },
            },
            data: { ownerUserId: null },
          });
        }
      }

      return result;
    }),

  /**
   * Reactivate a previously deactivated user.
   * Sensitive action: requires re-authentication.
   */
  reactivate: sensitiveActionProcedure
    .use(requirePermission({ member: ["update"] }))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await auth.api.unbanUser({
        headers: ctx.headers,
        body: { userId: input.userId },
      });

      return result;
    }),
});
