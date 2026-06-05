import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { DEMO_READ_ONLY } from '../errors';
import { t } from '../init';
import { isDemoContext, resolveDemoOrgId } from '../lib/demo';

const log = createLogger({ component: 'demo-read-only' });

/**
 * Demo read-only guard — the security boundary for demo mode.
 *
 * Blocks a call when ALL of:
 *   - `type === 'mutation'` (queries and subscriptions always pass through), and
 *   - the context is demo (`DEMO_MODE` globally, or the active org ∈ `DEMO_ORG_IDS`), and
 *   - the procedure is not explicitly allowlisted via `.meta({ allowInDemo: true })`.
 *
 * A blocked mutation throws `FORBIDDEN` with the machine-readable `DEMO_READ_ONLY`
 * marker (message + `cause.code`) and a generic, leak-free message. The guard runs
 * before any handler, so a blocked mutation produces no Prisma write and no audit
 * entry. It is sync + cheap (no DB call) — safe on the hot `authedProcedure` path.
 *
 * Opting a procedure in: add `.meta({ allowInDemo: true })` to its definition, e.g.
 *   `authedProcedure.meta({ allowInDemo: true }).mutation(...)`.
 * Tag only mutations that must keep working in a demo (none initially).
 */
export const demoReadOnly = t.middleware(({ ctx, type, meta, next }) => {
  if (type === 'mutation' && !meta?.allowInDemo && isDemoContext(ctx)) {
    log.info({ orgId: resolveDemoOrgId(ctx) }, 'demo context — blocking mutation');
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: DEMO_READ_ONLY,
      cause: { code: DEMO_READ_ONLY },
    });
  }
  return next();
});
