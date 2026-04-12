import { createTrpcLogger } from "@contractor-ops/logger";
import { metrics } from "@contractor-ops/logger/metrics";
import * as Sentry from "@sentry/nextjs";
import type { Context } from "../context.js";
import type { AnyMiddlewareFunction } from "@trpc/server";

/**
 * Raw observability middleware handler for tRPC procedures.
 *
 * Exported as a plain async function so `init.ts` can wrap it with
 * `t.middleware(...)` without a circular import (observability previously
 * imported `t` from init, which caused a TDZ error at module load time).
 *
 * - Creates a Sentry span for each procedure call
 * - Logs procedure execution with duration and context
 * - Tracks custom metrics (call count, duration, errors)
 */
export const observabilityMiddleware: AnyMiddlewareFunction = async (opts) => {
  const { path, type, ctx, next } = opts;
  const start = performance.now();
  const requestId = crypto.randomUUID();

  const context = ctx as Context;

  const userId = context.session?.user?.id;
  const organizationId = context.session?.session?.activeOrganizationId;

  const log = createTrpcLogger({
    procedure: path,
    type,
    userId: userId ?? undefined,
    organizationId: organizationId ?? undefined,
    requestId,
  });

  log.info("procedure started");

  return Sentry.startSpan(
    {
      name: `trpc/${path}`,
      op: "trpc.procedure",
      attributes: {
        "trpc.procedure": path,
        "trpc.type": type,
        ...(userId && { "user.id": userId }),
        ...(organizationId && { "org.id": organizationId }),
      },
    },
    async (span) => {
      try {
        const result = await next({
          ctx: { ...context, requestId },
        });

        const durationMs = Math.round(performance.now() - start);

        log.info({ durationMs }, "procedure completed");

        // Custom metrics
        metrics.distribution("trpc.duration", durationMs, {
          unit: "millisecond",
          tags: { procedure: path, type },
        });
        metrics.increment("trpc.calls", 1, {
          procedure: path,
          type,
          status: "ok",
        });

        span.setStatus({ code: 1 }); // OK

        return result;
      } catch (error) {
        const durationMs = Math.round(performance.now() - start);

        log.error({ err: error, durationMs }, "procedure failed");

        Sentry.captureException(error, {
          tags: {
            "trpc.procedure": path,
            "trpc.type": type,
          },
          extra: { requestId, userId, organizationId },
        });

        metrics.increment("trpc.calls", 1, {
          procedure: path,
          type,
          status: "error",
        });

        span.setStatus({ code: 2, message: "internal_error" }); // ERROR

        throw error;
      }
    },
  );
};
