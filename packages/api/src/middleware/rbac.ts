import type { Permission } from '@contractor-ops/auth';
import { authApi } from '@contractor-ops/auth';
import { TRPCError } from '@trpc/server';
import * as E from '../errors.js';
import { t } from '../init.js';
import { permissionToScopes } from '../lib/scope-utils.js';
import { tenantProcedure } from './tenant.js';

/**
 * RBAC middleware factory: creates a middleware that checks if the current
 * user/key has the specified permission in their active organization.
 *
 * - **Session auth**: delegates to Better Auth's `hasPermission` API.
 * - **API key auth**: checks the key's `scopes` array against required permissions.
 *
 * @param permission - Object mapping resources to required actions
 * @example requirePermission({ contractor: ["read", "update"] })
 */
export function requirePermission(permission: Permission) {
  const middleware = t.middleware(async ({ ctx, next }) => {
    // API key auth: check scopes instead of Better Auth session
    if (ctx.authMode === 'apiKey') {
      if (!ctx.apiKeyId || !ctx.apiKeyScopes) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: E.PERMISSION_DENIED,
        });
      }

      const required = permissionToScopes(permission);
      const granted = new Set(ctx.apiKeyScopes);
      const missing = required.filter(s => !granted.has(s));

      if (missing.length > 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: E.PERMISSION_DENIED,
        });
      }

      return next({ ctx });
    }

    // Session auth: delegate to Better Auth
    const hasPermission = await authApi.hasPermission({
      headers: ctx.headers,
      body: { permissions: permission },
    });

    if (!hasPermission?.success) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: E.PERMISSION_DENIED,
      });
    }

    return next({ ctx });
  });

  return middleware;
}

/**
 * Procedure that requires admin-level organization permissions.
 * Chain: auth -> tenant -> rbac(organization.update) -> handler
 */
export const adminProcedure = tenantProcedure.use(requirePermission({ organization: ['update'] }));
