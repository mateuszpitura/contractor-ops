import { z } from "zod";
import { auth } from "@contractor-ops/auth";
import { inviteUserSchema, updateUserRoleSchema } from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import { sensitiveActionProcedure } from "../middleware/sensitive.js";

export const userRouter = router({
  /**
   * List all members of the current organization.
   * Returns user details including name, email, role, and status.
   */
  list: tenantProcedure
    .use(requirePermission({ member: ["read"] }))
    .query(async ({ ctx }) => {
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
      const result = await auth.api.banUser({
        headers: ctx.headers,
        body: { userId: input.userId },
      });

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
