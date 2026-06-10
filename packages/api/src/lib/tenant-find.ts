import { findOrThrow } from './find-or-throw.js';

export type TenantScopedCtx = {
  organizationId: string;
};

type TenantScopedWhereSoftDelete = {
  id: string;
  organizationId: string;
  deletedAt: null;
};

type TenantScopedWhereOrgDefinition = {
  id: string;
  organizationId: string;
};

/**
 * Standard tenant-scoped where clause.
 * Pass `softDelete: false` for org-definition rows (Team, Project, CostCenter)
 * that have no `deletedAt` column.
 */
export function tenantScopedWhere(
  ctx: TenantScopedCtx,
  id: string,
  options?: { softDelete?: true },
): TenantScopedWhereSoftDelete;
export function tenantScopedWhere(
  ctx: TenantScopedCtx,
  id: string,
  options: { softDelete: false },
): TenantScopedWhereOrgDefinition;
export function tenantScopedWhere(
  ctx: TenantScopedCtx,
  id: string,
  options?: { softDelete?: boolean },
): TenantScopedWhereSoftDelete | TenantScopedWhereOrgDefinition {
  const base = { id, organizationId: ctx.organizationId };
  if (options?.softDelete === false) {
    return base;
  }
  return { ...base, deletedAt: null };
}

/**
 * Run a tenant-scoped findFirst and throw NOT_FOUND when missing.
 */
export async function findTenantFirstOrThrow<T>(
  finder: () => Promise<T | null | undefined>,
  errorMessage: string,
): Promise<NonNullable<T>> {
  return findOrThrow(finder, errorMessage);
}
