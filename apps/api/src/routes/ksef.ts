/**
 * KSeF sync worker (`POST /ksef/_sync`) port.
 *
 * Mirrors apps/web/src/app/api/ksef/_sync/route.ts:
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. Reseed ALS frame from upstream QStash headers (F-OBS-03).
 *   3. Wrap with `withQueueObservability('ksef-sync', …)` (F-ASYNC-17).
 *   4. Validate body shape (`organizationId`, `connectionId`).
 *   5. Delegate to `processKsefSync` — fetches, parses, creates, and
 *      matches invoices against the Polish KSeF tax-authority feed.
 *   6. 200 on success (QStash drops the job); 500 on error (retries
 *      per configured policy).
 *
 * Called by the hourly cron schedule (created on KSeF connect) and by
 * manual "Sync Now" tRPC triggers.
 *
 * Exempt from CSRF origin guard — QStash signature is the authn.
 */

import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { processKsefSync } from '@contractor-ops/api/services/ksef-sync-orchestrator';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../lib/qstash-verify.js';

const log = createCronLogger('ksef-sync');

const ksefSyncBodySchema = z.object({
  organizationId: z.string().min(1),
  connectionId: z.string().min(1),
});

// Adapter registry is process-singleton.
registerAllAdapters();

async function handlerInner(
  _request: FastifyRequest,
  reply: FastifyReply,
  rawBody: string,
): Promise<FastifyReply> {
  let parsedJson: unknown;
  try {
    parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    parsedJson = null;
  }

  const parsed = ksefSyncBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return reply.code(400).send({ error: detail });
  }
  const { organizationId, connectionId } = parsed.data;

  try {
    const result = await processKsefSync({ organizationId, connectionId });
    return reply.code(200).send({ processed: true, ...result });
  } catch (error) {
    log.error({ err: error, organizationId }, 'ksef sync failed');
    return reply.code(500).send({ error: 'KSeF sync failed' });
  }
}

export function registerKsefSyncRoute(app: FastifyInstance): void {
  app.post('/ksef/_sync', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    return guard.run(() =>
      withQueueObservability('ksef-sync', () => handlerInner(request, reply, guard.rawBody)),
    );
  });
}
