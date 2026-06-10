/**
 * QStash signature verification helper for Fastify routes.
 *
 * Wraps the framework-agnostic `Receiver` from `@upstash/qstash`.
 *
 * Multiple routes need it: `/webhooks/_process`, `/zatca/_submit`,
 * `/peppol/poll` (and any further QStash-driven endpoint). Each shares:
 *
 *   - Reject missing/empty `upstash-signature` with 401.
 *   - Rebuild absolute URL Fastify saw (trustProxy already applied X-F-*).
 *   - Refuse to boot the receiver if signing keys are missing (500 — the
 *     deployment is misconfigured; never silently accept the request).
 *   - Reseed the ALS frame from upstream headers BEFORE the inner
 *     handler runs so logger correlation IDs follow the job.
 *
 * Returns `{ verified: true, run }` on success — caller invokes `run(fn)`
 * to execute its handler under the rebuilt request context. Returns
 * `{ verified: false, replyDone }` on failure; caller must not touch
 * the reply further.
 */

import { buildContextFromHeaders, runWithRequestContext } from '@contractor-ops/logger';
import { Receiver } from '@upstash/qstash';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { loadEnv } from '../env.js';

let cachedReceiver: Receiver | null | undefined;

function getReceiver(): Receiver | null {
  if (cachedReceiver !== undefined) return cachedReceiver;
  const env = loadEnv();
  const currentSigningKey = env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = env.QSTASH_NEXT_SIGNING_KEY;
  if (!(currentSigningKey && nextSigningKey)) {
    cachedReceiver = null;
    return null;
  }
  cachedReceiver = new Receiver({ currentSigningKey, nextSigningKey });
  return cachedReceiver;
}

/** Test-only — reset the cached receiver between unit tests. */
export function __resetQStashReceiverForTests(): void {
  cachedReceiver = undefined;
}

export interface QStashGuardResult {
  /** Raw request body (UTF-8) — pre-decoded so caller can JSON.parse. */
  rawBody: string;
  /** Run `fn` inside the request-context frame seeded from QStash headers. */
  run<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Verify the `upstash-signature` header against the cached Receiver. On
 * failure the helper sends a terminal reply and returns null; the route
 * MUST stop touching the reply when null is returned.
 */
export async function guardQStashRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<QStashGuardResult | null> {
  const signature = request.headers['upstash-signature'];
  if (typeof signature !== 'string' || signature.length === 0) {
    await reply.code(401).send({ error: 'Missing upstash-signature header' });
    return null;
  }

  const rawBody =
    request.body instanceof Buffer
      ? request.body.toString('utf8')
      : typeof request.body === 'string'
        ? request.body
        : '';

  const receiver = getReceiver();
  if (!receiver) {
    await reply.code(500).send({ error: 'QStash signing keys missing — service is misconfigured' });
    return null;
  }

  const url = `${request.protocol}://${request.hostname}${request.url}`;

  let signatureValid = false;
  try {
    signatureValid = await receiver.verify({ signature, body: rawBody, url });
  } catch {
    await reply.code(401).send({ error: 'Invalid signature' });
    return null;
  }
  if (!signatureValid) {
    await reply.code(401).send({ error: 'Invalid signature' });
    return null;
  }

  // Fastify's `request.headers` is IncomingHttpHeaders (plain object);
  // `buildContextFromHeaders` expects a `Headers`-like `.get(name)`.
  const headerLookup = {
    get(name: string): string | null {
      const value = request.headers[name.toLowerCase()];
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value[0] ?? null;
      return null;
    },
  };
  const traceCtx = buildContextFromHeaders(headerLookup);

  return {
    rawBody,
    run: <T>(fn: () => Promise<T>) => runWithRequestContext(traceCtx, fn),
  };
}
