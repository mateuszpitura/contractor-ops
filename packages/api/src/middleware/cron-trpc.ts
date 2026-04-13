import { timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { t } from '../init.js';

/**
 * Requires `Authorization: Bearer <CRON_SECRET>` (same contract as /api/cron/* routes).
 * Use for tRPC mutations that should only be triggered by trusted schedulers (Vercel Cron, internal jobs).
 */
const cronTrpcMiddleware = t.middleware(({ ctx, next }) => {
  const cronSecret = getServerEnv().CRON_SECRET;

  const authHeader = ctx.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;
  const ok =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!ok) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next();
});

/**
 * Procedure protected by cron secret verification.
 * Use for tRPC endpoints called exclusively by scheduled jobs (QStash / Vercel Cron).
 */
export const cronProcedure = t.procedure.use(cronTrpcMiddleware);
