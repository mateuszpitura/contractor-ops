// apps/web/src/app/api/webhooks/storecove/route.ts
//
// Phase 61 · Plan 61-06 Task 2 — Storecove webhook handler.
//
// Receives transmission-status events from the Storecove Peppol network:
//   - invoice.transmission.success / invoice.transmission.delivered
//       → lifecycle SENT → DELIVERED + DELIVERY_ACK event.
//   - invoice.transmission.failed
//       → lifecycle → FAILED + DELIVERY_FAILED event.
//
// Security posture (per threat_model T-61-06-08 / T-61-06-10):
//   - HMAC-SHA256 signature verification over the raw body (reused from the
//     existing `StorecoveAdapter.verifyWebhookSignature` — no new crypto).
//   - Payloads are Zod-parsed at the adapter layer; unknown event types
//     are logged + discarded with 200 OK (non-retryable state).
//   - Idempotent: re-delivery of the same Storecove `guid` is a no-op
//     (we dedup on `eInvoiceLifecycleEvent.detailsJson.guid`).
//
// The handler matches transmissions by Storecove `guid`:
//   EInvoiceLifecycle.transmissionId === payload.guid (document_guid for
//   transmission events). Cross-tenant scope is implicit — the
//   `transmissionId` is globally unique (Storecove-assigned).
//
// Structured logging only — uses `@contractor-ops/logger`. No direct
// stdout / stderr writes; every error path routes through the logger.

import { prisma } from '@contractor-ops/db';
import type { WebhookVerification } from '@contractor-ops/einvoice';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const logger = createLogger({ service: 'webhook.storecove' });

// ---------------------------------------------------------------------------
// Event-type registry
// ---------------------------------------------------------------------------

const SUCCESS_EVENTS = new Set([
  'invoice.transmission.success',
  'invoice.transmission.delivered',
  'invoice.delivered',
]);

const FAILED_EVENTS = new Set(['invoice.transmission.failed', 'invoice.failed']);

// ---------------------------------------------------------------------------
// Adapter factory — global shared secret via STORECOVE_WEBHOOK_SECRET env
// var. Per-org adapter instances are resolved at send time; webhooks arrive
// without any tenant header, so we rely on a deployment-scoped shared
// secret (matches Storecove's sandbox + production webhook model).
// ---------------------------------------------------------------------------

function getWebhookSecret(): string | undefined {
  try {
    const env = getServerEnv() as Record<string, unknown>;
    const value = env.STORECOVE_WEBHOOK_SECRET;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return;
  }
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

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read raw body for HMAC.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // 2. Headers as plain record (adapter expects that shape).
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // 3. Verify HMAC.
  const verifier = buildVerifier();
  if (!verifier) {
    logger.error(
      { configured: false },
      'Storecove webhook received but STORECOVE_WEBHOOK_SECRET is not configured',
    );
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const verification: WebhookVerification = verifier.verifyWebhookSignature(rawBody, headers);
  if (!verification.valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 4. Parse payload. Zod-validated at the adapter layer — malformed
  // payloads surface as exceptions we catch and turn into 400s.
  let payload: Awaited<ReturnType<typeof verifier.parseWebhookPayload>>;
  try {
    payload = await verifier.parseWebhookPayload(rawBody, headers);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Storecove webhook payload parse failed',
    );
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Storecove event kind lives on `metadata.event`; `metadata.guid` is the
  // globally unique Storecove message id we use to correlate with the
  // EInvoiceLifecycle row.
  const eventType = (payload.metadata.event as string | undefined) ?? '';
  const guid = (payload.metadata.guid as string | undefined) ?? '';
  if (!guid) {
    logger.warn({ eventType }, 'Storecove webhook missing guid — discarding');
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // 5. Find the lifecycle row by transmissionId = guid. If none, log +
  // 200 (not a webhook error; the document might belong to another env).
  const lifecycle = await prisma.eInvoiceLifecycle.findFirst({
    where: { transmissionId: guid },
    select: {
      id: true,
      organizationId: true,
      transmissionStatus: true,
    },
  });

  if (!lifecycle) {
    logger.info({ guid, eventType }, 'Storecove webhook: no matching lifecycle — ignoring');
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // 6. Idempotency — if we've already persisted an event for this guid,
  // return 200 without writing again. Match on detailsJson.guid path.
  const existingEvent = await prisma.eInvoiceLifecycleEvent.findFirst({
    where: {
      organizationId: lifecycle.organizationId,
      lifecycleId: lifecycle.id,
      detailsJson: { path: ['guid'], equals: guid },
    },
    select: { id: true },
  });
  if (existingEvent) {
    logger.info(
      { guid, eventType, lifecycleId: lifecycle.id },
      'Storecove webhook: duplicate event (guid already recorded) — noop',
    );
    return NextResponse.json({ received: true, idempotent: true }, { status: 200 });
  }

  // 7. Classify + persist atomically.
  const isSuccess = SUCCESS_EVENTS.has(eventType);
  const isFailure = FAILED_EVENTS.has(eventType);
  if (!(isSuccess || isFailure)) {
    logger.info({ eventType, guid }, 'Storecove webhook: unknown event — noop');
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
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
    logger.error(
      {
        guid,
        eventType,
        lifecycleId: lifecycle.id,
        err: err instanceof Error ? err.message : String(err),
      },
      'Storecove webhook transaction failed',
    );
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  logger.info(
    { guid, eventType, lifecycleId: lifecycle.id, success: isSuccess },
    'Storecove webhook processed',
  );
  return NextResponse.json({ received: true }, { status: 200 });
}
