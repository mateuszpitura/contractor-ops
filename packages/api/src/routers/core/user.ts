import { authApi } from '@contractor-ops/auth';
import { inviteUserSchema, updateUserRoleSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init.js';
import { requirePermission } from '../../middleware/rbac.js';
import { sensitiveActionProcedure } from '../../middleware/sensitive.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import type { DbClient } from '../../services/types.js';

// ---------------------------------------------------------------------------
// Deactivation helpers
// ---------------------------------------------------------------------------

/**
 * Prevents deactivating the last admin/owner in an organization.
 */
async function guardLastAdmin(db: DbClient, organizationId: string, userId: string) {
  const targetMember = await db.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });

  if (!targetMember || (targetMember.role !== 'owner' && targetMember.role !== 'admin')) {
    return;
  }

  const adminCount = await db.member.count({
    where: {
      organizationId,
      role: { in: ['owner', 'admin'] },
      user: { banned: { not: true } },
    },
  });

  if (adminCount <= 1) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'LAST_ADMIN_CANNOT_DEACTIVATE',
    });
  }
}

/**
 * Reassigns pending approval steps from a deactivated user to another member
 * with the same role, or clears the assignment.
 */
async function reassignPendingApprovalSteps(
  db: DbClient,
  organizationId: string,
  deactivatedUserId: string,
) {
  const pendingSteps = await db.approvalStep.findMany({
    where: {
      organizationId,
      approverUserId: deactivatedUserId,
      status: { in: ['NOT_STARTED', 'PENDING'] },
    },
    select: { id: true, approverRole: true },
  });

  for (const step of pendingSteps) {
    let replacementUserId: string | null = null;

    if (step.approverRole) {
      const replacement = await db.member.findFirst({
        where: {
          organizationId,
          role: step.approverRole,
          userId: { not: deactivatedUserId },
          user: { banned: { not: true } },
        },
        select: { userId: true },
      });
      replacementUserId = replacement?.userId ?? null;
    }

    await db.approvalStep.update({
      where: { id: step.id },
      data: { approverUserId: replacementUserId },
    });
  }
}

/**
 * Transfers contractor ownership from a deactivated user to an admin,
 * or clears ownership if no admin is available.
 */
async function transferContractorOwnership(
  db: DbClient,
  organizationId: string,
  deactivatedUserId: string,
) {
  const ownedContractors = await db.contractor.findMany({
    where: {
      organizationId,
      ownerUserId: deactivatedUserId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (ownedContractors.length === 0) return;

  const replacement = await db.member.findFirst({
    where: {
      organizationId,
      role: { in: ['owner', 'admin'] },
      userId: { not: deactivatedUserId },
      user: { banned: { not: true } },
    },
    select: { userId: true },
  });

  await db.contractor.updateMany({
    where: { id: { in: ownedContractors.map((c: { id: string }) => c.id) } },
    data: { ownerUserId: replacement?.userId ?? null },
  });
}

// ---------------------------------------------------------------------------
// User router
// ---------------------------------------------------------------------------

export const userRouter = router({
  /**
   * List all members of the current organization.
   * Returns user details including name, email, role, and status.
   */
  list: tenantProcedure.use(requirePermission({ member: ['read'] })).query(async ({ ctx }) => {
    const org = await authApi.getFullOrganization({
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
    .use(requirePermission({ member: ['create'] }))
    .input(inviteUserSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await authApi.createInvitation({
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
   *
   * F-SEC-14 — Better Auth's `updateMemberRole` resolves by `memberId`
   * (Member primary key), NOT user id. The validator surface keeps
   * `userId` for caller ergonomics; we translate to `Member.id` here
   * scoped to the active org. `findFirstOrThrow` raises NOT_FOUND when
   * the supplied user is not a member of the caller's org, blocking
   * silent no-ops or accidental cross-org role changes.
   */
  updateRole: sensitiveActionProcedure
    .use(requirePermission({ member: ['update'] }))
    .input(updateUserRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.member.findFirstOrThrow({
        where: { organizationId: ctx.organizationId, userId: input.userId },
        select: { id: true },
      });

      const result = await authApi.updateMemberRole({
        headers: ctx.headers,
        body: {
          memberId: member.id,
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
    .use(requirePermission({ member: ['delete'] }))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await guardLastAdmin(ctx.db, ctx.organizationId, input.userId);

      const result = await authApi.banUser({
        headers: ctx.headers,
        body: { userId: input.userId },
      });

      // Reassign pending approval steps and transfer contractor ownership
      await reassignPendingApprovalSteps(ctx.db, ctx.organizationId, input.userId);
      await transferContractorOwnership(ctx.db, ctx.organizationId, input.userId);

      return result;
    }),

  /**
   * Reactivate a previously deactivated user.
   * Sensitive action: requires re-authentication.
   */
  reactivate: sensitiveActionProcedure
    .use(requirePermission({ member: ['update'] }))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await authApi.unbanUser({
        headers: ctx.headers,
        body: { userId: input.userId },
      });

      return result;
    }),

  /**
   * Phase 74 D-08 — Set User.outOfOffice JSONB.
   *
   * Actor identity (the `userId` whose OOO is being modified) MUST equal
   * the session user — users cannot set OOO for other users from this
   * mutation. Cross-tenant updates are blocked because Member is
   * scoped to ctx.organizationId. Admins can set other users' OOO via
   * the admin override flow (out of scope for Phase 74).
   */
  setOutOfOffice: tenantProcedure
    .input(
      z.object({
        from: z.iso.datetime(),
        until: z.iso.datetime(),
        fallbackUserId: z.string().min(1).optional(),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // T-74-05 — server derives userId from session, never from input
      const userId = ctx.user.id;
      await ctx.db.user.update({
        where: { id: userId },
        data: {
          outOfOffice: {
            from: input.from,
            until: input.until,
            ...(input.fallbackUserId ? { fallbackUserId: input.fallbackUserId } : {}),
            ...(input.reason ? { reason: input.reason } : {}),
          },
        },
      });
      return { userId };
    }),

  clearOutOfOffice: tenantProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    await ctx.db.user.update({
      where: { id: userId },
      data: { outOfOffice: undefined as never },
    });
    return { userId };
  }),
});
