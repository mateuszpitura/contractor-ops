import { TRPCError } from "@trpc/server";
import { publicProcedure, t } from "../init.js";

/**
 * Auth middleware: requires an authenticated session.
 * Throws UNAUTHORIZED if no valid session exists or the user is banned.
 */
export const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!(ctx.session && ctx.user)) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (ctx.user.banned) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ACCOUNT_BANNED",
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
 * Chain: auth -> handler
 */
export const authedProcedure = publicProcedure.use(authMiddleware);
