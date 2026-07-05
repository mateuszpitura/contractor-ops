// Outbound webhook event catalog + delivery envelope.
//
// The 16 locked event types are a closed enum — a producer referencing a new
// type is a compile error until it is added here. The delivery envelope is a
// Zod discriminated union on `type`, each variant `.strict()` so an unknown
// type or an injected privileged key (mass-assignment) is rejected.

import { z } from 'zod';

/** The 16 locked outbound event types (INTEG-WEBHOOK-02). */
export const WEBHOOK_EVENT_TYPES = [
  'contractor.created',
  'contractor.updated',
  'contractor.offboarded',
  'contractor.compliance_blocked',
  'invoice.received',
  'invoice.matched',
  'invoice.approved',
  'invoice.rejected',
  'invoice.paid',
  'payment_run.created',
  'payment_run.completed',
  'workflow.task.completed',
  'workflow.completed',
  'classification.outcome',
  'compliance_doc.expiring_soon',
  'compliance_doc.expired',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const webhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPES);

const ENVELOPE_BASE = {
  id: z.string().min(1),
  created_at: z.string().min(1),
  organization_id: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  include_pii: z.boolean(),
};

const envelopeVariants = WEBHOOK_EVENT_TYPES.map(type =>
  z.object({ type: z.literal(type), ...ENVELOPE_BASE }).strict(),
);

/**
 * The delivery envelope: `{ id, type, created_at, organization_id, data,
 * include_pii }`. Discriminated on `type` and strict per variant.
 */
export const webhookEventEnvelopeSchema = z.discriminatedUnion(
  'type',
  envelopeVariants as [(typeof envelopeVariants)[number], ...(typeof envelopeVariants)[number][]],
);

export type WebhookEventEnvelope = z.infer<typeof webhookEventEnvelopeSchema>;
