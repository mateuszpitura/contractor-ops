/**
 * OCR processor (`POST /ocr/_process`).
 *
 *   1. QStash signature verification via `defineQStashRoute`.
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

import { processOcrExtraction } from '@contractor-ops/api/services/ocr-extraction';
import { BackpressureRoutes } from '@contractor-ops/api/services/qstash-backpressure';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { defineQStashRoute } from '../lib/qstash-route.js';
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

export function registerOcrProcessRoute(app: FastifyInstance): void {
  const { key, max } = BackpressureRoutes.OCR_PROCESS;

  defineQStashRoute(app, {
    path: '/ocr/_process',
    observabilityName: key,
    bodySchema: ocrProcessBodySchema,
    backpressure: { key, max },
    handler: async (body, { reply }) => {
      const { extractionId, organizationId, storageKey } = body;

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
    },
  });
}
