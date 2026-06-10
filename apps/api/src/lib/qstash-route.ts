import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import {
  isBackpressureRejected,
  withBackpressure,
} from '@contractor-ops/api/services/qstash-backpressure';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import { guardQStashRequest } from './qstash-verify.js';

export type QStashBackpressureConfig = {
  key: string;
  max: number;
};

export type QStashRouteConfig<TBody extends z.ZodType> = {
  path: string;
  observabilityName: string;
  bodySchema: TBody;
  backpressure?: QStashBackpressureConfig;
  handler: (
    body: z.infer<TBody>,
    ctx: { request: FastifyRequest; reply: FastifyReply },
  ) => Promise<FastifyReply>;
};

/**
 * Register a QStash-guarded POST route with observability + Zod body validation.
 */
export function defineQStashRoute<TBody extends z.ZodType>(
  app: FastifyInstance,
  config: QStashRouteConfig<TBody>,
): void {
  app.post(config.path, async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    const runObserved = () =>
      withQueueObservability(config.observabilityName, async () => {
        let parsedJson: unknown;
        try {
          parsedJson = guard.rawBody.length > 0 ? JSON.parse(guard.rawBody) : null;
        } catch {
          parsedJson = null;
        }

        const parsed = config.bodySchema.safeParse(parsedJson);
        if (!parsed.success) {
          const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
          const detail =
            missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
          return reply.code(400).send({ error: detail });
        }

        return config.handler(parsed.data, { request, reply });
      });

    if (config.backpressure) {
      const { key, max } = config.backpressure;
      return guard.run(async () => {
        try {
          return await withBackpressure(key, max, runObserved);
        } catch (err) {
          if (isBackpressureRejected(err)) {
            return reply.code(429).header('Retry-After', String(err.retryAfterSec)).send();
          }
          throw err;
        }
      });
    }

    return guard.run(runObserved);
  });
}
