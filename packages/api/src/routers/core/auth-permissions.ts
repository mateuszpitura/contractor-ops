// Phase 74 Plan 05 — Permission introspection query.
//
// Returns the resource-action map for the current session's role, enabling
// belt-and-suspenders UI gating in Plan 74-08 (the override dialog only
// renders when `workflow` includes `override_blocking_task`).
//
// Server-side derivation only — client cannot override the role used for the
// lookup (T-74-05-permission-introspection-bypass mitigation).

import { roles } from '@contractor-ops/auth';
import { createLogger } from '@contractor-ops/logger';
import { router } from '../init.js';
import { authedProcedure } from '../middleware/auth.js';

const logger = createLogger({ service: 'auth-permissions' });

export const authPermissionsRouter = router({
  /**
   * Returns the resource-action map for the current user's role, e.g.
   *   { workflow: ['create', 'read', ..., 'override_blocking_task'], ... }
   *
   * The role is derived from the authenticated session's active member row.
   * Unknown / missing roles return an empty object — the caller treats that
   * as "no permissions".
   */
  getCurrentUserPermissions: authedProcedure.query(async ({ ctx }) => {
    const session = ctx.session as
      | { user?: { id?: string; role?: string }; activeRole?: string }
      | undefined;
    const roleName =
      (session?.activeRole as keyof typeof roles | undefined) ??
      (session?.user?.role as keyof typeof roles | undefined);
    if (!roleName) {
      logger.warn(
        { userId: session?.user?.id },
        'no role on session — returning empty permissions',
      );
      return {} as Record<string, readonly string[]>;
    }
    const role = roles[roleName];
    if (!role) {
      logger.warn({ roleName, userId: session?.user?.id }, 'unknown role on session');
      return {} as Record<string, readonly string[]>;
    }
    // Better Auth role.statements is the source-of-truth shape; mirror Plan 74-03.
    return (role.statements ?? {}) as Record<string, readonly string[]>;
  }),
});
