/**
 * OCR processor (`POST /ocr/_process`).
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. Reseed ALS frame from upstream QStash headers (F-OBS-03).
 *   3. F-SCALE-19 — wrap with `withBackpressure(OCR_PROCESS)` so an
 *      Anthropic spike doesn't sink other QStash consumers.
 *   4. F-ASYNC-17 — `withQueueObservability` reports per-tick duration.
 *   5. Validate body shape (`extractionId`, `organizationId`, `storageKey`).
 *   6. Delegate to `processOcrExtraction` from the service. The service
 *      catches + marks rows FAILED on permanent OCR errors itself, so
 *      reaching this route's catch is rare (R2 outage, OOM).
 *   7. F-ASYNC-16 — classify infrastructure errors as permanent (200,
 *      QStash drops) vs transient (500, QStash retries). Permanent
 *      failures get a Sentry capture for ops visibility.
 *
 * Exempt from CSRF origin guard — `/ocr/` prefix added to
 * EXEMPT_PREFIXES; QStash signature owns authn.
 */

import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { processOcrExtraction } from '@contractor-ops/api/services/ocr-extraction';
import {
  BackpressureRoutes,
  isBackpressureRejected,
  withBackpressure,
} from '@contractor-ops/api/services/qstash-backpressure';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../lib/qstash-verify.js';
import { Sentry } from '../lib/sentry.js';

const log = createCronLogger('ocr-process');

const ocrProcessBodySchema = z.object({
  extractionId: z.string().min(1),
  organizationId: z.string().min(1),
  storageKey: z.string().min(1),
});

// Adapter registry is process-singleton.
registerAllAdapters();

function classifyOcrError(err: unknown): { status: number; reason: 'permanent' | 'transient' } {
  if (!(err instanceof Error)) return { status: 500, reason: 'transient' };
  const msg = err.message.toLowerCase();
  if (
    msg.includes('not found') ||
    msg.includes('invalid pdf') ||
    msg.includes('unsupported') ||
    msg.includes('corrupt') ||
    msg.includes('400') ||
    msg.includes('404')
  ) {
    return { status: 200, reason: 'permanent' };
  }
  return { status: 500, reason: 'transient' };
}

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

  const parsed = ocrProcessBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return reply.code(400).send({ error: detail });
  }
  const { extractionId, organizationId, storageKey } = parsed.data;

  try {
    await processOcrExtraction({ extractionId, organizationId, storageKey });
    return reply.code(200).send({ processed: true });
  } catch (error) {
    const classified = classifyOcrError(error);
    log.error(
      { err: error, extractionId, classification: classified.reason },
      'ocr processing failed at route boundary',
    );
    if (classified.reason === 'permanent') {
      Sentry.captureException(error, {
        tags: { 'ocr.outcome': 'permanent-failure' },
        extra: { extractionId, organizationId },
      });
    }
    return reply
      .code(classified.status)
      .send({ error: 'Processing failed', classification: classified.reason });
  }
}

export function registerOcrProcessRoute(app: FastifyInstance): void {
  app.post('/ocr/_process', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    const { key, max } = BackpressureRoutes.OCR_PROCESS;
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
