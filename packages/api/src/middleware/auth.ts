import { TRPCError } from "@trpc/server";
import { t, publicProcedure } from "../init.js";

/**
 * Auth middleware: requires an authenticated session.
 * Throws UNAUTHORIZED if no valid session exists.
 */
export const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
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
 * Chain: auth -> handler
 */
export const authedProcedure = publicProcedure.use(authMiddleware);
