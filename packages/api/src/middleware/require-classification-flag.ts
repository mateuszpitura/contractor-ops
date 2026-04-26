// packages/api/src/middleware/require-classification-flag.ts
//
// Phase 64 · D-06 — defense-in-depth middleware for all classification tRPC procedures.
//
// Every classification procedure must use `classificationProcedure` (= tenantProcedure
// + this middleware) instead of raw `tenantProcedure`. Two enforcement layers:
//   1. Conditional root.ts registration (D-05, Plan 64-04) — procedures absent from
//      appRouter when the global flag is OFF.
//   2. This middleware — per-org / per-jurisdiction evaluation at request time.
//      If Unleash has the flag ON globally but the evaluator's disclaimer gate (D-10)
//      or per-org evaluation returns false, this middleware throws FORBIDDEN before
//      any business logic executes.
//
// Error code: FORBIDDEN with message 'CLASSIFICATION_ENGINE_DISABLED' so clients
// can distinguish from generic auth failures.

import { evaluate } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { tenantProcedure } from './tenant.js';

const log = createLogger({ service: 'classification-flag-guard' });

export const classificationProcedure = tenantProcedure.use(async ({ ctx, next }) => {
  const region = ctx.region === 'ME' ? ('ME' as const) : ('EU' as const);

  const result = evaluate('module.classification-engine', {
    organizationId: ctx.organizationId,
    region,
  });

  if (!result.enabled) {
    log.warn(
      {
        organizationId: ctx.organizationId,
        reason: result.reason,
        flag: 'module.classification-engine',
      },
      'classification procedure blocked: flag disabled',
    );
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'CLASSIFICATION_ENGINE_DISABLED',
      cause: { flag: 'module.classification-engine', reason: result.reason },
    });
  }

  return next();
});
