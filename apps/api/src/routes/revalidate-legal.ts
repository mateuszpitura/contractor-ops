/**
 * Legal cache invalidation hook.
 *
 * Replaces the legacy Next ISR `revalidateTag('legal:...')` with a
 * cross-process broadcast: the API publishes a Redis message that any
 * connected SPA instance receives over its existing TanStack Query
 * websocket / poll bridge, triggering `queryClient.invalidateQueries`
 * on the matching legal-content query keys. No SSR cache exists in the
 * new CSR-only architecture, so the invalidation is purely client-side.
 *
 * Security:
 *   - HMAC-SHA256 over the raw body using `CMS_WEBHOOK_SECRET`. Same
 *     domain-separator-free shape as the legacy implementation so the
 *     existing CMS publisher works without changes.
 *   - Exempt from the CSRF origin guard (Payload CMS posts without an
 *     Origin header).
 *
 * Side effect: the Redis publish key (`legal:invalidate`) is consumed by
 * the SPA's TanStack Query subscriber wired in Step 12 follow-up; in
 * this branch we publish a log line + Sentry breadcrumb as a stub until
 * the subscriber lands.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createLogger } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../env.js';
import { Sentry } from '../lib/sentry.js';

const log = createLogger({ service: 'revalidate-legal' });

interface Payload {
  type?: string;
  jurisdiction?: string;
  locale?: string;
}

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function registerRevalidateLegalRoute(app: FastifyInstance): void {
  app.post('/revalidate-legal', async (request, reply) => {
    const secret = loadEnv().CMS_WEBHOOK_SECRET;
    if (!secret) {
      log.error({}, 'CMS_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ ok: false, reason: 'not_configured' });
    }

    const rawBody =
      request.body instanceof Buffer
        ? request.body.toString('utf8')
        : typeof request.body === 'string'
          ? request.body
          : '';
    const signature = (request.headers['x-cms-signature'] as string | undefined) ?? null;

    if (!verifySignature(rawBody, signature, secret)) {
      log.warn({ signature }, 'rejected webhook: bad signature');
      return reply.code(401).send({ ok: false, reason: 'bad_signature' });
    }

    let parsed: Payload | null = null;
    try {
      parsed = rawBody.length === 0 ? null : (JSON.parse(rawBody) as Payload);
    } catch {
      return reply.code(400).send({ ok: false, reason: 'bad_json' });
    }
    const type = parsed?.type;
    const jurisdiction = parsed?.jurisdiction;
    if (!(type && jurisdiction)) {
      return reply.code(400).send({ ok: false, reason: 'missing_fields' });
    }

    const tag = `legal:${type}:${jurisdiction}`;
    // Stub: publish on Redis pub/sub once the SPA subscriber lands in
    // Step 12 follow-up. Until then, log + breadcrumb so operators see
    // the invalidation request flow through.
    log.info({ tag, locale: parsed?.locale }, 'legal invalidation requested');
    Sentry.addBreadcrumb({
      category: 'legal-invalidation',
      level: 'info',
      message: `legal invalidation requested for tag ${tag}`,
      data: { tag, locale: parsed?.locale },
    });

    return reply.code(200).send({ ok: true, tag });
  });
}
