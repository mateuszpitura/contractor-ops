// Outbox event-type → handler registry (P2-A, F-ASYNC-03).
//
// Handlers receive the OutboxEvent.id (for downstream idempotency) plus the
// typed payload. Throwing means "transient failure, retry"; returning
// normally means "dispatched, mark DISPATCHED".
//
// To add a new event type:
//   1. Add a `OutboxEventType` literal below.
//   2. Add a typed payload entry to `OutboxEventPayloadMap`.
//   3. Add a handler entry to `outboxHandlerRegistry`.
//   4. Producers call `enqueueOutboxEvent({ tx, eventType: '...', payload, ...})`.

import { createLogger } from '@contractor-ops/logger';

import type { NotificationEvent } from '../notification-service';
import { dispatch as dispatchNotification } from '../notification-service';

const log = createLogger({ service: 'outbox-handlers' });

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

/**
 * The typed event-type catalogue. Add a literal here when introducing a new
 * outboxed side effect.
 */
export type OutboxEventType = 'notification.dispatch';
// Future: 'integration.webhook.publish' | 'search.reindex' | etc.

/**
 * Per-event payload contract. The handler signature is statically tied to
 * the same map so a typo on one side is a tsc error.
 */
export interface OutboxEventPayloadMap {
  'notification.dispatch': NotificationEvent;
}

export interface OutboxHandlerContext {
  /** OutboxEvent.id — pass to downstream services as their idempotency key. */
  outboxEventId: string;
  organizationId: string;
}

export type OutboxHandler<TType extends OutboxEventType> = (
  payload: OutboxEventPayloadMap[TType],
  ctx: OutboxHandlerContext,
) => Promise<void>;

type OutboxHandlerRegistry = {
  [K in OutboxEventType]: OutboxHandler<K>;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const handleNotificationDispatch: OutboxHandler<'notification.dispatch'> = async (payload, ctx) => {
  // NEW-ARCH-04: thread the OutboxEvent.id through the notification
  // service so it becomes the canonical idempotency key. The notification
  // service uses it as the (organizationId, dedupKey) value AND threads it
  // into Resend's `Idempotency-Key` header. This closes the cross-bucket
  // double-send window when the outbox redrives an event whose original
  // attempt already issued the side effect.
  log.debug(
    {
      outboxEventId: ctx.outboxEventId,
      organizationId: ctx.organizationId,
      type: payload.type,
      recipients: payload.recipientUserIds.length,
    },
    'dispatching notification.dispatch outbox event',
  );

  await dispatchNotification(payload, { outboxEventId: ctx.outboxEventId });
};

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const outboxHandlerRegistry: OutboxHandlerRegistry = {
  'notification.dispatch': handleNotificationDispatch,
};

interface DispatchOutboxEventInput {
  id: string;
  organizationId: string;
  eventType: OutboxEventType;
  payload: unknown;
}

/**
 * Routes an outbox row to its typed handler. Unknown event types throw —
 * which surfaces in the drain as a transient failure → retry → exhaust →
 * Sentry capture, exactly the behaviour we want for "operator forgot to
 * register the handler" bugs.
 */
export async function dispatchOutboxEvent(input: DispatchOutboxEventInput): Promise<void> {
  const handler = outboxHandlerRegistry[input.eventType];
  if (!handler) {
    throw new Error(`No outbox handler registered for eventType=${input.eventType}`);
  }

  // The unknown→typed cast is local to the dispatcher: the producer wrote a
  // typed payload via `enqueueOutboxEvent`, the column is jsonb in
  // Postgres, and the registry map enforces handler/payload type alignment.
  // A schema drift here would still surface as a runtime error inside the
  // handler (e.g. "Cannot read property 'recipientUserIds' of undefined")
  // which the drain treats as transient → retry → exhaust → Sentry.
  // biome-ignore lint/suspicious/noExplicitAny: registry-driven dispatch
  const typedPayload = input.payload as any;
  await handler(typedPayload, {
    outboxEventId: input.id,
    organizationId: input.organizationId,
  });
}
