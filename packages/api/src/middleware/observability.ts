import { createTrpcLogger, generateRequestId, runWithRequestContext } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/node';
import type { AnyMiddlewareFunction } from '@trpc/server';
import type { Context } from '../context';

// ---------------------------------------------------------------------------
// PII-sensitive procedure prefixes — never log input/output bodies for these
// ---------------------------------------------------------------------------
//
// Phase 58 (Plan 03) / T-58-PII / ASVS V8: classification answers are PII
// (hours worked, billing ratio, free-text rationales describing the working
// relationship). Audit / metric entries still record procedure path, userId,
// organizationId, duration and outcome code, but the `input` and `result`
// bodies MUST NOT be logged. This constant is grep-asserted by the plan's
// acceptance criteria — do not rename without updating CLASS-11 tests.
export const LOG_BODY_EXCLUDE_PREFIXES: readonly string[] = ['classification.'];

/**
 * Returns true when the given tRPC procedure path should NEVER have its
 * input/output body captured by the logger / metrics layer. Prefix match
 * keeps us forward-compatible with new `classification.*` procedures added
 * by downstream phases (e.g. Phase 59 document chain-tracking).
 */
export function isBodyLoggingExcluded(procedurePath: string): boolean {
  return LOG_BODY_EXCLUDE_PREFIXES.some(prefix => procedurePath.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// F-SCALE-16 — bounded `procedure` label cardinality on metrics
// ---------------------------------------------------------------------------
//
// `metrics.distribution('trpc.duration', …, { tags: { procedure: path } })`
// emits a label per distinct procedure path. Today the appRouter has ~600
// procedures across 55 routers — bounded but trending upward. Sentry /
// Datadog charge per timeseries; an unbounded `procedure` label would also
// blow up the metrics index when (a) a future feature accidentally embeds
// a user-supplied id in the path, or (b) the router list grows past the
// platform's per-metric cardinality limit (typical ceiling: 10 000).
//
// To stay forward-safe without enumerating ~600 procedures by hand, we
// learn the procedure set lazily up to a hard cap, then bucket any new
// path observed past the cap as `_other`. The cap is set to
// `MAX_PROCEDURE_LABELS = 1000` — large enough that the realistic appRouter
// fits with headroom; small enough that an accidental high-cardinality
// path still triggers the safety bucket.
//
// The known-set persists for the process lifetime (no TTL) — the appRouter
// shape is fixed at module load, so a path that appeared once will be
// observed again on the next request.
const MAX_PROCEDURE_LABELS = 1000;
const knownProcedureLabels = new Set<string>();
const OTHER_PROCEDURE_BUCKET = '_other';

/**
 * Returns the metric label to use for a tRPC procedure path. First call for
 * each path seeds the known-set; once the set is at the cap, every new path
 * collapses into the `_other` bucket.
 *
 * Exported for tests and so future emitters (e.g. RED metrics in
 * route handlers) can reuse the same allow-listing logic — keeping the
 * bucket name consistent across our metric surface.
 */
export function bucketedProcedureLabel(path: string): string {
  if (knownProcedureLabels.has(path)) return path;
  if (knownProcedureLabels.size < MAX_PROCEDURE_LABELS) {
    knownProcedureLabels.add(path);
    return path;
  }
  return OTHER_PROCEDURE_BUCKET;
}

/** Test helper — clears the per-process known-set so cardinality tests can
 *  exercise the cap behaviour deterministically. */
export function __resetProcedureLabelsForTests(): void {
  knownProcedureLabels.clear();
}

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
export const observabilityMiddleware: AnyMiddlewareFunction = async opts => {
  const { path, type, ctx, next } = opts;
  const start = performance.now();
  // P2-E F-OBS-02: requestId is now seeded into AsyncLocalStorage so that
  // module-scoped child loggers in routers / services automatically carry it
  // on every log line via the Pino mixin in @contractor-ops/logger. Use the
  // shared generator (UUID v7 when supported) instead of a raw v4.
  const requestId = generateRequestId();

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

  return runWithRequestContext({ requestId }, async () =>
    Sentry.startSpan(
      {
        name: `trpc/${path}`,
        op: 'trpc.procedure',
        attributes: {
          'trpc.procedure': path,
          'trpc.type': type,
          ...(userId && { 'user.id': userId }),
          ...(organizationId && { 'org.id': organizationId }),
        },
      },
      async span => {
        // F-OBS-14: attach user + org to the current Sentry isolation scope
        // so the dashboard's "users affected" and per-org filter both work.
        // Span attributes alone do not power those Sentry features. The
        // tRPC plugin (apps/api/src/plugins/trpc.ts) wraps each request
        // with `withIsolationScope`, so these scope mutations do not leak
        // into other concurrent requests.
        const scope = Sentry.getCurrentScope();
        if (userId) {
          scope.setUser({ id: userId });
        }
        if (organizationId) {
          scope.setTag('org.id', organizationId);
        }
        scope.setTag('trpc.procedure', path);

        log.info('procedure started');
        try {
          const result = await next({
            ctx: { ...context, requestId },
          });

          const durationMs = Math.round(performance.now() - start);

          log.info({ durationMs }, 'procedure completed');

          // Custom metrics — `procedure` tag goes through the F-SCALE-16
          // bucket so cardinality stays bounded even if a future router
          // accidentally embeds a per-request id in the path.
          const procedureLabel = bucketedProcedureLabel(path);
          metrics.distribution('trpc.duration', durationMs, {
            unit: 'millisecond',
            tags: { procedure: procedureLabel, type },
          });
          metrics.increment('trpc.calls', 1, {
            procedure: procedureLabel,
            type,
            status: 'ok',
          });

          span.setStatus({ code: 1 }); // OK

          return result;
        } catch (error) {
          const durationMs = Math.round(performance.now() - start);

          log.error({ err: error, durationMs }, 'procedure failed');

          Sentry.captureException(error, {
            tags: {
              'trpc.procedure': path,
              'trpc.type': type,
            },
            extra: { requestId, userId, organizationId },
          });

          // F-SCALE-16: same bucketing on the error path so the
          // `_other` bucket aggregates both ok and error counts when the
          // cap is hit, rather than silently dropping the procedure tag.
          const errorProcedureLabel = bucketedProcedureLabel(path);
          metrics.increment('trpc.calls', 1, {
            procedure: errorProcedureLabel,
            type,
            status: 'error',
          });

          span.setStatus({ code: 2, message: 'internal_error' }); // ERROR

          throw error;
        }
      },
    ),
  );
};
