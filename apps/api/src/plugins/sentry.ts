/**
 * Sentry-Fastify glue.
 *
 * `initSentry()` from `lib/sentry.ts` must already have been invoked at
 * the process entrypoint — this module only wires Fastify hooks that
 * capture per-request exceptions and tag them with the request id +
 * route.
 *
 * `setErrorHandler` is replaced rather than chained so framework errors
 * (4xx serialization failures, body too large, etc.) keep their original
 * response shape but still beacon to Sentry.
 */

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Sentry } from '../lib/sentry.js';

export function registerSentryHooks(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const status = error.statusCode ?? 500;
    // Capture only true server errors and uncategorised throws. Client
    // errors (4xx) are expected paths — beaconing them costs Sentry quota
    // for no signal.
    if (status >= 500) {
      Sentry.captureException(error, {
        tags: { component: 'api-server', route: request.routeOptions?.url ?? request.url },
        extra: { requestId: request.requestId, method: request.method },
      });
    }
    reply.code(status).send({ error: error.message || 'Internal Server Error' });
  });
}
