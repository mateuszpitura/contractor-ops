import { TRPCError } from "@trpc/server";
import { t } from "../init.js";

/**
 * tRPC middleware that verifies the request is from a trusted cron source.
 *
 * Validates the `x-cron-secret` header against CRON_SECRET env var.
 * Use this for tRPC mutations that are called by QStash or Vercel Cron
 * and must not be publicly accessible.
 *
 * Pattern mirrors the CRON_SECRET bearer-token check used in
 * `apps/web/src/app/api/cron/token-refresh/route.ts` and similar routes.
 */
const cronTrpcMiddleware = t.middleware(async ({ ctx, next }) => {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "CRON_SECRET is not configured",
    });
  }

  const headerSecret = ctx.headers.get("x-cron-secret");

  if (!headerSecret || headerSecret !== cronSecret) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or missing cron secret",
    });
  }

  return next({ ctx });
});

/**
 * Procedure protected by cron secret verification.
 * Use for tRPC endpoints called exclusively by scheduled jobs (QStash / Vercel Cron).
 */
export const cronProcedure = t.procedure.use(cronTrpcMiddleware);
