import { timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { t } from "../init.js";

/**
 * Requires `Authorization: Bearer <CRON_SECRET>` (same contract as /api/cron/* routes).
 * Use for tRPC mutations that should only be triggered by trusted schedulers (Vercel Cron, internal jobs).
 */
export const cronTrpcMiddleware = t.middleware(({ ctx, next }) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "CRON_SECRET is not configured",
    });
  }

  const authHeader = ctx.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  const ok =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!ok) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next();
});
