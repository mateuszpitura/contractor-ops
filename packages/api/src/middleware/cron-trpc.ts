import { timingSafeEqual } from 'node:crypto';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { SERVER_MISCONFIGURED } from '../errors';
import { t } from '../init';

const log = createLogger({ service: 'cron-trpc-middleware' });

/**
 * Requires `Authorization: Bearer <CRON_SECRET>` (same contract as /api/cron/* routes).
 * Use for tRPC mutations that should only be triggered by trusted schedulers (Vercel Cron, internal jobs).
 */
const cronTrpcMiddleware = t.middleware(({ ctx, next }) => {
  // Resolve via getServerEnv so the env validator (z.string().min(16)) gates startup.
  // Defensive guard ensures we never accept a missing/short secret which would let
  // `Authorization: Bearer ` (length 7) bypass the auth check.
  const cronSecret = getServerEnv().CRON_SECRET;
  if (!cronSecret || cronSecret.length < 16) {
    log.error('CRON_SECRET misconfigured — rejecting cron tRPC call');
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: SERVER_MISCONFIGURED });
  }

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
