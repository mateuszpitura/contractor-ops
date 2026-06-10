import type { Permission } from '@contractor-ops/auth';
import type { SubscriptionTier } from '@contractor-ops/db/generated/prisma/client';
import { requirePermission } from '../middleware/rbac';
import { tenantProcedure } from '../middleware/tenant';
import { requireTier } from '../middleware/tier';

export type IntegrationProcedureOptions = {
  permission?: Permission;
  tier?: SubscriptionTier;
};

/**
 * Shared tRPC procedure factory for integration routers.
 * Chain: auth -> tenant -> [requirePermission] -> [requireTier] -> handler
 */
export function integrationProcedure(options: IntegrationProcedureOptions = {}) {
  let procedure = tenantProcedure;

  if (options.permission) {
    procedure = procedure.use(requirePermission(options.permission));
  }

  if (options.tier) {
    procedure = procedure.use(requireTier(options.tier));
  }

  return procedure;
}

/**
 * Convenience factory for integration procedures gated on `settings` permissions.
 */
export function integrationSettingsProcedure(action: 'read' | 'update', tier?: SubscriptionTier) {
  return integrationProcedure({
    permission: { settings: [action] },
    ...(tier ? { tier } : {}),
  });
}
