import type { Permission } from '@contractor-ops/auth';
import { authApi } from '@contractor-ops/auth';
import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import { t } from '../init';
import { permissionToScopes } from '../lib/scope-utils';
import { tenantProcedure } from './tenant';

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
      if (!(ctx.apiKeyId && ctx.apiKeyScopes)) {
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

      return next();
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

    return next({ ctx: { ...ctx } });
  });

  return middleware;
}

/** Minimal context shape the permission check reads (both auth modes). */
export interface PermissionCheckContext {
  authMode?: string;
  apiKeyId?: string | null;
  apiKeyScopes?: readonly string[] | null;
  headers: Headers;
}

/**
 * Predicate form of the RBAC check — returns whether the caller holds `permission`
 * under whichever auth mode is active (API-key scopes or a Better Auth session).
 * Reused by `requireAnyPermission` and by per-request, resource-aware body gates
 * (e.g. the approval procedures' resourceType→permission assertion).
 */
export async function hasPermission(
  ctx: PermissionCheckContext,
  permission: Permission,
): Promise<boolean> {
  if (ctx.authMode === 'apiKey') {
    if (!(ctx.apiKeyId && ctx.apiKeyScopes)) return false;
    const required = permissionToScopes(permission);
    const granted = new Set(ctx.apiKeyScopes);
    return required.every(s => granted.has(s));
  }

  const result = await authApi.hasPermission({
    headers: ctx.headers,
    body: { permissions: permission },
  });
  return Boolean(result?.success);
}

/**
 * Coarse OR-set gate: passes when the caller holds ANY of the supplied permission
 * objects, rejects a caller holding none. Fine-grained, per-resource enforcement
 * (which of the OR-set a specific resource requires) is a body assertion via
 * {@link hasPermission} after the resource is fetched — this middleware only
 * admits callers who could act on at least one branch, without over-granting.
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return t.middleware(async ({ ctx, next }) => {
    for (const permission of permissions) {
      if (await hasPermission(ctx, permission)) {
        return next();
      }
    }
    throw new TRPCError({ code: 'FORBIDDEN', message: E.PERMISSION_DENIED });
  });
}

/**
 * Procedure that requires admin-level organization permissions.
 * Chain: auth -> tenant -> rbac(organization.update) -> handler
 */
export const adminProcedure = tenantProcedure.use(requirePermission({ organization: ['update'] }));
