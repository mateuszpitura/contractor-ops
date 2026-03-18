import { TRPCError } from "@trpc/server";
import { auth } from "@contractor-ops/auth";
import type { Session } from "@contractor-ops/auth";
import { t, publicProcedure } from "../init";

/**
 * Auth middleware: validates the session via Better Auth.
 * Adds session and user to the tRPC context.
 * Throws UNAUTHORIZED if no valid session exists.
 */
export const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: ctx.headers });

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: { ...ctx, session, user: session.user },
  });
});

/** Context type after auth middleware has run */
export type AuthedContext = {
  headers: Headers;
  session: Session;
  user: Session["user"];
};

/**
 * Procedure that requires an authenticated user.
 * Chain: auth -> handler
 */
export const authedProcedure = publicProcedure.use(authMiddleware);
