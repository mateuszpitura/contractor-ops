import { TRPCError } from '@trpc/server';
import { t } from '../init.js';
import { tenantProcedure } from './tenant.js';

const SENSITIVE_ACTION_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware that checks if the current session was created recently enough
 * to perform sensitive actions. If the session's createdAt timestamp is older
 * than SENSITIVE_ACTION_MAX_AGE_MS, the user must re-authenticate.
 *
 * Throws FORBIDDEN with cause "REAUTH_REQUIRED" so the client can prompt
 * the user to re-enter their password.
 *
 * Used for: role changes, user deactivation/reactivation, settings updates,
 * payment runs — any operation where a stale session poses a security risk.
 */
export const sensitiveActionMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const sessionCreatedAt = new Date(ctx.session.session.createdAt).getTime();
  const now = Date.now();

  if (now - sessionCreatedAt > SENSITIVE_ACTION_MAX_AGE_MS) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This action requires re-authentication. Please sign in again to continue.',
      cause: 'REAUTH_REQUIRED',
    });
  }

  return next({ ctx });
});

/**
 * Procedure that requires both tenant scope and a fresh session.
 * Use for: role changes, user deactivation, settings updates.
 * Chain: auth -> tenant -> sensitive -> handler
 */
export const sensitiveActionProcedure = tenantProcedure.use(sensitiveActionMiddleware);
