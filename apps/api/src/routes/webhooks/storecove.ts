/**
 * Storecove (Peppol BIS) webhook port.
 *
 * Mirrors apps/web/src/app/api/webhooks/storecove/route.ts step-for-step:
 *
 *   1. Read raw body (HMAC verification needs the original bytes).
 *   2. Construct a `StorecoveAdapter` seeded with the global
 *      STORECOVE_WEBHOOK_SECRET env var — Storecove uses a single
 *      deployment-scoped secret (no per-tenant signing material).
 *   3. Verify the HMAC-SHA256 signature; 401 on mismatch.
 *   4. Parse the payload (Zod-validated by the adapter); 400 on malformed.
 *   5. Look up the matching `EInvoiceLifecycle` row by `transmissionId =
 *      payload.metadata.guid` — Storecove guids are globally unique.
 *   6. Idempotency check: skip if we already recorded an event for this
 *      guid (`eInvoiceLifecycleEvent.detailsJson.guid` path lookup).
 *   7. Inside a single transaction, update lifecycle status to
 *      DELIVERED / FAILED + write a DELIVERY_ACK / DELIVERY_FAILED event.
 *   8. Unknown event types → 200 noop (Storecove won't retry).
 *
 * Lives under the webhook plugin scope so the raw-body content-type
 * parser is in effect. Exempt from the CSRF origin guard (handled by
 * HMAC verify instead — Storecove sends with no Origin header).
 */

import { prisma } from '@contractor-ops/db';
import type { WebhookVerification } from '@contractor-ops/einvoice';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { createWebhookLogger } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../../env.js';
import { Sentry } from '../../lib/sentry.js';

const log = createWebhookLogger('storecove');

const SUCCESS_EVENTS = new Set([
  'invoice.transmission.success',
  'invoice.transmission.delivered',
  'invoice.delivered',
]);

const FAILED_EVENTS = new Set(['invoice.transmission.failed', 'invoice.failed']);

function getWebhookSecret(): string | undefined {
  const value = loadEnv().STORECOVE_WEBHOOK_SECRET;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function buildVerifier(): StorecoveAdapter | null {
  const secret = getWebhookSecret();
  if (!secret) return null;
  return new StorecoveAdapter({
    apiKey: 'webhook-only',
    baseUrl: 'https://api.storecove.com/api/v2',
    webhookSecret: secret,
  });
}

export function registerStorecoveWebhookRoute(app: FastifyInstance): void {
  app.post('/webhooks/storecove', async (request, reply) => {
    const rawBody =
      request.body instanceof Buffer
        ? request.body.toString('utf8')
        : typeof request.body === 'string'
          ? request.body
          : '';

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers[key] = value;
      else if (Array.isArray(value)) headers[key] = value.join(',');
    }

    const verifier = buildVerifier();
    if (!verifier) {
      log.error(
        { configured: false },
        'Storecove webhook received but STORECOVE_WEBHOOK_SECRET is not configured',
      );
      return reply.code(500).send({ error: 'Not configured' });
    }

    const verification: WebhookVerification = verifier.verifyWebhookSignature(rawBody, headers);
    if (!verification.valid) {
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    let payload: Awaited<ReturnType<typeof verifier.parseWebhookPayload>>;
    try {
      payload = await verifier.parseWebhookPayload(rawBody, headers);
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'Storecove webhook payload parse failed',
      );
      return reply.code(400).send({ error: 'Invalid payload' });
    }

    const metadata = (payload.metadata ?? {}) as Record<string, unknown>;
    const eventType = typeof metadata.event === 'string' ? metadata.event : '';
    const guid = typeof metadata.guid === 'string' ? metadata.guid : '';

    if (!guid) {
      log.warn({ eventType }, 'Storecove webhook missing guid — discarding');
      return reply.code(200).send({ received: true });
    }

    const lifecycle = await prisma.eInvoiceLifecycle.findFirst({
      where: { transmissionId: guid },
      select: {
        id: true,
        organizationId: true,
        transmissionStatus: true,
      },
    });

    if (!lifecycle) {
      log.info({ guid, eventType }, 'Storecove webhook: no matching lifecycle — ignoring');
      return reply.code(200).send({ received: true });
    }

    const existingEvent = await prisma.eInvoiceLifecycleEvent.findFirst({
      where: {
        organizationId: lifecycle.organizationId,
        lifecycleId: lifecycle.id,
        detailsJson: { path: ['guid'], equals: guid },
      },
      select: { id: true },
    });
    if (existingEvent) {
      log.info(
        { guid, eventType, lifecycleId: lifecycle.id },
        'Storecove webhook: duplicate event (guid already recorded) — noop',
      );
      return reply.code(200).send({ received: true, idempotent: true });
    }

    const isSuccess = SUCCESS_EVENTS.has(eventType);
    const isFailure = FAILED_EVENTS.has(eventType);
    if (!(isSuccess || isFailure)) {
      log.info({ eventType, guid }, 'Storecove webhook: unknown event — noop');
      return reply.code(200).send({ received: true, ignored: true });
    }

    const now = new Date();
    try {
      await prisma.$transaction(async tx => {
        if (isSuccess) {
          await tx.eInvoiceLifecycle.update({
            where: { id: lifecycle.id },
            data: {
              transmissionStatus: 'DELIVERED',
              deliveredAt: now,
              deliveryAckJson: { guid, event: eventType, receivedAt: now },
            },
          });
          await tx.eInvoiceLifecycleEvent.create({
            data: {
              organizationId: lifecycle.organizationId,
              lifecycleId: lifecycle.id,
              eventType: 'DELIVERY_ACK',
              occurredAt: now,
              actorUserId: null,
              detailsJson: { guid, event: eventType },
            },
          });
        } else {
          await tx.eInvoiceLifecycle.update({
            where: { id: lifecycle.id },
            data: {
              transmissionStatus: 'FAILED',
              lastErrorJson: { guid, event: eventType, receivedAt: now },
            },
          });
          await tx.eInvoiceLifecycleEvent.create({
            data: {
              organizationId: lifecycle.organizationId,
              lifecycleId: lifecycle.id,
              eventType: 'DELIVERY_FAILED',
              occurredAt: now,
              actorUserId: null,
              detailsJson: { guid, event: eventType },
            },
          });
        }
      });
    } catch (err) {
      log.error(
        {
          guid,
          eventType,
          lifecycleId: lifecycle.id,
          err: err instanceof Error ? err.message : String(err),
        },
        'Storecove webhook transaction failed',
      );
      Sentry.captureException(err, {
        tags: { 'webhook.provider': 'storecove', 'webhook.event_type': eventType },
        extra: { guid, lifecycleId: lifecycle.id },
      });
      return reply.code(500).send({ error: 'Internal error' });
    }

    log.info(
      { guid, eventType, lifecycleId: lifecycle.id, success: isSuccess },
      'Storecove webhook processed',
    );
    return reply.code(200).send({ received: true });
  });
}
