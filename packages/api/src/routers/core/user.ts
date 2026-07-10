import { authApi, userRoleToMemberRole } from '@contractor-ops/auth';
import { inviteUserSchema, updateUserRoleSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CANNOT_DEACTIVATE_SELF,
  LAST_ADMIN_CANNOT_DEACTIVATE,
  MEMBER_HAS_PENDING_APPROVALS,
  PERMISSION_DENIED,
} from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { sensitiveActionProcedure } from '../../middleware/sensitive';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import type { DbClient } from '../../services/types';
import { userPinsRouter } from './user-pins';

// ---------------------------------------------------------------------------
// Role privilege gate
// ---------------------------------------------------------------------------

// Roles that confer org-wide privilege escalation (payment:export,
// compliance:override, contractor:delete, etc.). Granting one of these is
// gated by the caller's own role below — `requirePermission({ member:
// ['update'] })` alone does NOT stop a non-admin (e.g. it_admin) from minting
// admins or escalating themselves. Maps each privileged target role to the
// set of caller roles allowed to grant it.
const ROLE_GRANT_REQUIREMENTS: Record<string, ReadonlySet<string>> = {
  owner: new Set(['owner']),
  admin: new Set(['owner', 'admin']),
};

// ---------------------------------------------------------------------------
// Deactivation helpers
// ---------------------------------------------------------------------------

/**
 * Prevents deactivating the last admin/owner in an organization and confirms
 * the target user is actually a member of the caller's org.
 *
 * Returns the resolved Member row (id + role) so callers can perform the
 * follow-up update in a single round-trip.
 *
 * The prior implementation returned silently when the target was not a member
 * of the caller's org, allowing a downstream global `banUser` call to lock
 * any enumerated user out platform-wide. We now throw NOT_FOUND.
 */
async function guardLastAdmin(
  db: DbClient,
  organizationId: string,
  userId: string,
): Promise<{ id: string; role: string }> {
  const targetMember = await findOrThrow(
    () =>
      db.member.findFirst({
        where: { organizationId, userId },
        select: { id: true, role: true },
      }),
    'MEMBER_NOT_FOUND',
  );

  // Non-admin/owner roles can always be deactivated.
  if (targetMember.role !== 'owner' && targetMember.role !== 'admin') {
    return targetMember;
  }

  // Count active (non-disabled) admins/owners in this org. Per-membership
  // soft-disable via `disabledAt` is the mechanism; the old `User.banned`
  // global ban no longer drives this query.
  const adminCount = await db.member.count({
    where: {
      organizationId,
      role: { in: ['owner', 'admin'] },
      disabledAt: null,
    },
  });

  if (adminCount <= 1) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: LAST_ADMIN_CANNOT_DEACTIVATE,
    });
  }

  return targetMember;
}

/**
 * Plans reassignment for pending approval steps. Returns null replacement when
 * no same-role peer or admin fallback exists.
 */
async function planPendingApprovalReassignments(
  db: DbClient,
  organizationId: string,
  deactivatedUserId: string,
): Promise<Array<{ stepId: string; replacementUserId: string | null }>> {
  const pendingSteps = await db.approvalStep.findMany({
    where: {
      organizationId,
      approverUserId: deactivatedUserId,
      status: { in: ['NOT_STARTED', 'PENDING'] },
    },
    select: { id: true, approverRole: true },
  });

  const adminFallback = await db.member.findFirst({
    where: {
      organizationId,
      role: { in: ['owner', 'admin'] },
      userId: { not: deactivatedUserId },
      disabledAt: null,
    },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });

  const plans: Array<{ stepId: string; replacementUserId: string | null }> = [];

  for (const step of pendingSteps) {
    let replacementUserId: string | null = null;

    if (step.approverRole) {
      const memberRole = userRoleToMemberRole(step.approverRole);
      const replacement = memberRole
        ? await db.member.findFirst({
            where: {
              organizationId,
              role: memberRole,
              userId: { not: deactivatedUserId },
              disabledAt: null,
            },
            select: { userId: true },
          })
        : null;
      replacementUserId = replacement?.userId ?? null;
    }

    if (!replacementUserId) {
      replacementUserId = adminFallback?.userId ?? null;
    }

    plans.push({ stepId: step.id, replacementUserId });
  }

  return plans;
}

async function applyPendingApprovalReassignments(
  db: DbClient,
  plans: Array<{ stepId: string; replacementUserId: string | null }>,
): Promise<void> {
  for (const plan of plans) {
    if (!plan.replacementUserId) continue;
    await db.approvalStep.update({
      where: { id: plan.stepId },
      data: { approverUserId: plan.replacementUserId },
    });
  }
}

/**
 * Blocks deactivation when pending approval steps cannot be reassigned.
 */
async function assertPendingApprovalsReassignable(
  db: DbClient,
  organizationId: string,
  deactivatedUserId: string,
): Promise<Array<{ stepId: string; replacementUserId: string | null }>> {
  const plans = await planPendingApprovalReassignments(db, organizationId, deactivatedUserId);
  const orphaned = plans.filter(p => !p.replacementUserId);
  if (orphaned.length > 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: MEMBER_HAS_PENDING_APPROVALS,
      cause: { orphanedStepIds: orphaned.map(p => p.stepId) },
    });
  }
  return plans;
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
      // Replacement must be an active (non-disabled) admin/owner of this
      // org; the prior `user.banned` global filter is no longer used.
      disabledAt: null,
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

      // Invitations grant org access and are audited so admins can trace
      // who invited whom.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'MEMBER_INVITE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: {
          invitedRole: input.role,
          // Email logged in audit-only context; not in app log streams.
          invitedEmail: input.email,
        },
      });

      return result;
    }),

  /**
   * Update a member's role in the organization.
   * Sensitive action: requires re-authentication if session > 5 minutes old.
   *
   * Better Auth's `updateMemberRole` resolves by `memberId` (Member primary
   * key), NOT user id. The validator surface keeps `userId` for caller
   * ergonomics; we translate to `Member.id` here scoped to the active org.
   * `findFirstOrThrow` raises NOT_FOUND when the supplied user is not a
   * member of the caller's org, blocking silent no-ops or accidental
   * cross-org role changes.
   */
  updateRole: sensitiveActionProcedure
    .use(requirePermission({ member: ['update'] }))
    .input(updateUserRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.member.findFirstOrThrow({
        where: { organizationId: ctx.organizationId, userId: input.userId },
        select: { id: true, role: true },
      });

      // Privilege ceiling: a caller may not grant a role more privileged than
      // their own. Better Auth's `updateMemberRole` only blocks the owner
      // transition, so without this gate any `member:['update']` holder below
      // admin (e.g. it_admin) could mint admins — including escalating itself.
      const allowedGranters = ROLE_GRANT_REQUIREMENTS[input.role];
      if (allowedGranters) {
        const caller = await ctx.db.member.findFirst({
          where: { organizationId: ctx.organizationId, userId: ctx.user.id },
          select: { role: true },
        });
        if (!(caller && allowedGranters.has(caller.role))) {
          throw new TRPCError({ code: 'FORBIDDEN', message: PERMISSION_DENIED });
        }
      }

      const result = await authApi.updateMemberRole({
        headers: ctx.headers,
        body: {
          memberId: member.id,
          role: input.role,
          organizationId: ctx.organizationId,
        },
      });

      // RBAC changes are SOC 2 / ISO 27001 evidence. Audit before/after.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'MEMBER_ROLE_UPDATE',
        resourceType: 'USER',
        resourceId: input.userId,
        oldValues: { role: member.role },
        newValues: { role: input.role },
        metadata: { memberId: member.id },
      });

      return result;
    }),

  /**
   * Deactivate a member of the current organization (per-membership soft
   * disable). Sensitive action: requires re-authentication.
   *
   * The prior implementation called Better Auth's `banUser`, which locked the
   * target out of every org they belonged to. We now flip `Member.disabledAt`
   * for the membership in the caller's org only; sessions whose
   * `activeOrganizationId` resolves to that membership are rejected by the
   * Better Auth `databaseHooks.session.create.before` hook (see
   * `packages/auth/src/config.ts`). Other org memberships keep working.
   */
  deactivate: sensitiveActionProcedure
    .use(requirePermission({ member: ['delete'] }))
    .input(
      z.object({
        userId: z.string().min(1),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: CANNOT_DEACTIVATE_SELF,
        });
      }

      const targetMember = await guardLastAdmin(ctx.db, ctx.organizationId, input.userId);

      const reassignmentPlans = await assertPendingApprovalsReassignable(
        ctx.db,
        ctx.organizationId,
        input.userId,
      );

      const updated = await ctx.db.member.update({
        where: { id: targetMember.id },
        data: {
          disabledAt: new Date(),
          disabledByUserId: ctx.user.id,
          disabledReason: input.reason ?? null,
        },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          disabledAt: true,
        },
      });

      // Reassign pending approval steps and transfer contractor ownership
      // within the active org. These helpers operate scoped by
      // `organizationId` so cross-org state is untouched.
      await applyPendingApprovalReassignments(ctx.db, reassignmentPlans);
      await transferContractorOwnership(ctx.db, ctx.organizationId, input.userId);

      // Deactivation transfers approvals + contractor ownership;
      // forensics needs an immutable trail.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'MEMBER_DEACTIVATE',
        resourceType: 'USER',
        resourceId: input.userId,
        oldValues: { role: targetMember.role, disabledAt: null },
        newValues: { disabledAt: updated.disabledAt },
        metadata: {
          memberId: targetMember.id,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      });

      return updated;
    }),

  /**
   * Reactivate a previously soft-disabled membership (per-org).
   * Sensitive action: requires re-authentication.
   *
   * Clears the per-membership `disabledAt` flag. Throws NOT_FOUND if the
   * supplied user is not a member of the caller's org.
   */
  reactivate: sensitiveActionProcedure
    .use(requirePermission({ member: ['update'] }))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const targetMember = await findOrThrow(
        () =>
          ctx.db.member.findFirst({
            where: { organizationId: ctx.organizationId, userId: input.userId },
            select: { id: true },
          }),
        'MEMBER_NOT_FOUND',
      );

      const updated = await ctx.db.member.update({
        where: { id: targetMember.id },
        data: {
          disabledAt: null,
          disabledByUserId: null,
          disabledReason: null,
        },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          disabledAt: true,
        },
      });

      // Reactivation restores org access; pair with deactivate audit.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'MEMBER_REACTIVATE',
        resourceType: 'USER',
        resourceId: input.userId,
        metadata: { memberId: targetMember.id },
      });

      return updated;
    }),

  /**
   * Set User.outOfOffice JSONB.
   *
   * Actor identity (the `userId` whose OOO is being modified) MUST equal
   * the session user — users cannot set OOO for other users from this
   * mutation. Cross-tenant updates are blocked because Member is scoped to
   * ctx.organizationId. Admins can set other users' OOO via the admin
   * override flow.
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
      // Server derives userId from session, never from input
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

  pins: userPinsRouter,
});
