/**
 * Per-request correlation id + Pino ALS frame for every Fastify route.
 *
 * Wraps the entire request lifecycle in `runWithRequestContext` so any
 * Pino logger created downstream — including module-scoped loggers in
 * `packages/api` routers — emits `{ requestId }` automatically.
 *
 * Honors an inbound `x-request-id` header (operator probes, upstream
 * tracers) and mints a fresh UUID otherwise. Echoes the id back on every
 * response so a failing call leaves a single id the on-call can pivot
 * across Pino, Sentry, and outbound integration logs.
 *
 * Uses Fastify's `done`-callback hook style (not async) so the
 * AsyncLocalStorage frame bound by `runWithRequestContext` brackets every
 * subsequent hook + handler + onSend stage. The async variant resumes the
 * awaiter outside the ALS frame — `getRequestContext()` then returns
 * undefined for the actual handler, defeating the point.
 */

import { runWithRequestContext } from '@contractor-ops/logger';
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

export function registerRequestContext(app: FastifyInstance): void {
  app.addHook(
    'onRequest',
    (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
      const incoming = (request.headers['x-request-id'] as string | undefined)?.trim();
      const requestId = incoming || globalThis.crypto.randomUUID();
      request.requestId = requestId;
      reply.header('x-request-id', requestId);

      // Bind the ALS frame for the remainder of the request lifecycle.
      // Calling done() inside ALS.run keeps the rest of the request pipeline
      // (preHandler, handler, onSend, onResponse) inside this frame.
      runWithRequestContext({ requestId }, () => {
        done();
      });
    },
  );
}
