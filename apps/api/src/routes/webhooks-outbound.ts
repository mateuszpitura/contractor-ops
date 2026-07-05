/**
 * Outbound webhook deliver drain (`POST /webhooks-outbound/_deliver`).
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. Parse the `{ attemptId }` body from the exact verified bytes.
 *   3. `deliverAttempt` claims the row (CAS), enforces the kill switch + per-sub
 *      rate limit, re-checks SSRF, signs, and POSTs via the DNS-rebind-guarded
 *      agent — recording success / scheduling the next attempt / dead-lettering.
 *
 * The DB row owns the authoritative backoff; `deliverAttempt` never throws on a
 * delivery failure (it records + re-enqueues), so this route returns 200 and
 * QStash does not re-invoke it. A 500 is reserved for the route itself failing.
 */

import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { deliverAttempt } from '@contractor-ops/api/services/webhooks/dispatcher';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../lib/qstash-verify.js';
import { Sentry } from '../lib/sentry.js';

const log = createCronLogger('webhooks-outbound-deliver');

const bodySchema = z.object({ attemptId: z.string().min(1) });

async function handlerInner(reply: FastifyReply, rawBody: string): Promise<FastifyReply> {
  let parsedJson: unknown;
  try {
    parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    parsedJson = null;
  }

  const parsed = bodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid body' });
  }

  return withQueueObservability('webhooks-outbound-deliver', async () => {
    try {
      await deliverAttempt(parsed.data.attemptId);
      return reply.code(200).send({ processed: true });
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err), attemptId: parsed.data.attemptId },
        'webhook deliver failed',
      );
      Sentry.captureException(err, { tags: { 'webhook.outcome': 'deliver-error' } });
      return reply.code(500).send({ error: 'deliver failed' });
    }
  });
}

export function registerOutboundWebhookDeliverRoute(app: FastifyInstance): void {
  app.post('/webhooks-outbound/_deliver', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    return guard.run(() => handlerInner(reply, guard.rawBody));
  });
}
