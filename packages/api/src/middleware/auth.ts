import { TRPCError } from '@trpc/server';
import { ACCOUNT_BANNED } from '../errors';
import { publicProcedure, t } from '../init';
import { demoReadOnly } from './demo';

/**
 * Auth middleware: requires an authenticated session.
 * Throws UNAUTHORIZED if no valid session exists or the user is banned.
 */
export const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!(ctx.session && ctx.user)) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  if (ctx.user.banned) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: ACCOUNT_BANNED,
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    },
  });
});

/**
 * Procedure that requires an authenticated user.
 * Chain: auth -> demoReadOnly -> handler
 *
 * `demoReadOnly` is anchored here so the entire staff `appRouter` (everything
 * built on `authedProcedure`/`tenantProcedure`, including `org.create`) inherits
 * the demo mutation guard from one place. It runs after auth (so the session —
 * and its `activeOrganizationId` — is available) and before any handler.
 */
export const authedProcedure = publicProcedure.use(authMiddleware).use(demoReadOnly);
