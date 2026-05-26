/**
 * Core Web Vitals ingestion endpoint.
 *
 * Receives one metric per beacon from the SPA's
 * `src/web-vitals.ts#startWebVitals` reporter. Emits a structured Pino
 * log per metric; logs stream to Axiom via the existing pipeline. No
 * separate vendor SDK is required — the Phase-1 PostHog forwarder
 * (apps/web's prior implementation) is preserved by the same log →
 * Axiom → PostHog pipe.
 *
 * Always returns 204 so a failed parse cannot trigger a browser retry.
 *
 * Exempt from CSRF origin guard because beacons fire via `sendBeacon`
 * without an Origin header on pagehide.
 */

import { createLogger } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const log = createLogger({ service: 'web-vitals' });

const webVitalSchema = z
  .object({
    name: z.string().optional(),
    value: z.number().optional(),
    rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
    delta: z.number().optional(),
    id: z.string().optional(),
    navigationType: z.string().optional(),
    locale: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();

export function registerWebVitalsRoute(app: FastifyInstance): void {
  app.post('/web-vitals', async (request, reply) => {
    const parsed = webVitalSchema.safeParse(request.body);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues }, 'web-vitals: invalid payload');
      return reply.code(204).send();
    }

    log.info(
      {
        webVital: parsed.data,
        userAgent: request.headers['user-agent'] ?? undefined,
      },
      'web-vital',
    );

    return reply.code(204).send();
  });
}
