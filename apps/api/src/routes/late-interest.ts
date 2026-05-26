/**
 * Late-payment claim PDF renderer (`POST /late-interest/_render-claim-pdf`)
 * port. Mirrors apps/web/src/app/api/late-interest/_render-claim-pdf/route.ts.
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. Reseed ALS frame (F-OBS-03).
 *   3. F-SCALE-19 — `withBackpressure(LATE_INTEREST_RENDER)` caps the
 *      concurrent @react-pdf renders so a retry burst can't OOM the pod.
 *   4. F-ASYNC-17 — `withQueueObservability` reports per-tick duration.
 *   5. Validate body shape (`claimId`, `organizationId`).
 *   6. Delegate to `renderClaimPdf(claimId)`; the service marks the row
 *      FAILED with a truncated error message on failure so operators can
 *      diagnose without trawling Sentry.
 *   7. 200 on success; 500 on error → QStash retries per the configured policy.
 *
 * Triggered from `latePaymentInterest.claim` after the row is persisted
 * with `pdfStatus: PENDING_RENDER`; the client polls
 * `latePaymentInterest.downloadClaim` until `pdfStatus === READY`.
 * Exempt from CSRF origin guard via `/late-interest/` prefix.
 */

import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { renderClaimPdf } from '@contractor-ops/api/services/late-payment-claim-pdf';
import {
  BackpressureRoutes,
  isBackpressureRejected,
  withBackpressure,
} from '@contractor-ops/api/services/qstash-backpressure';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../lib/qstash-verify.js';

const log = createCronLogger('late-interest-render-claim-pdf');

const bodySchema = z.object({
  claimId: z.string().min(1),
  organizationId: z.string().min(1),
});

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

  const parsed = bodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid body' });
  }
  const { claimId } = parsed.data;

  try {
    const result = await renderClaimPdf(claimId);
    return reply.code(200).send({ processed: true, ...result });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), claimId },
      'claim pdf render failed',
    );
    return reply.code(500).send({ error: 'render failed' });
  }
}

export function registerLateInterestRenderRoute(app: FastifyInstance): void {
  app.post('/late-interest/_render-claim-pdf', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    const { key, max } = BackpressureRoutes.LATE_INTEREST_RENDER;
    return guard.run(async () => {
      try {
        return await withBackpressure(key, max, () =>
          withQueueObservability(key, () => handlerInner(request, reply, guard.rawBody)),
        );
      } catch (err) {
        if (isBackpressureRejected(err)) {
          return reply.code(429).header('Retry-After', String(err.retryAfterSec)).send();
        }
        throw err;
      }
    });
  });
}
