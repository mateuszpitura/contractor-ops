import { TRPCError } from "@trpc/server";
import { auth } from "@contractor-ops/auth";
import type { Permission } from "@contractor-ops/auth";
import { t } from "../init";
import { tenantProcedure } from "./tenant";

/**
 * RBAC middleware factory: creates a middleware that checks if the current
 * user has the specified permission in their active organization.
 *
 * Uses Better Auth's hasPermission API endpoint for server-side checks.
 *
 * @param permission - Object mapping resources to required actions
 * @example requirePermission({ contractor: ["read", "update"] })
 */
export function requirePermission(permission: Permission) {
  return t.middleware(async ({ ctx, next }) => {
    const hasPermission = await auth.api.hasPermission({
      headers: ctx.headers,
      body: { permissions: permission },
    });

    if (!hasPermission?.success) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
    }

    return next({ ctx });
  });
}

/**
 * Procedure that requires admin-level organization permissions.
 * Chain: auth -> tenant -> rbac(organization.update) -> handler
 */
export const adminProcedure = tenantProcedure.use(
  requirePermission({ organization: ["update"] }),
);
