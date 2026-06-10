// ---------------------------------------------------------------------------
// Per-provider webhook payload schemas
// ---------------------------------------------------------------------------
//
// The generic webhook ingress route (`/webhooks/:provider`) used to
// persist whatever JSON.parse returned (or `{ raw: rawBody.slice(0, 10000) }`
// on parse failure) directly into `WebhookDelivery.payloadJson`. This left
// downstream `_process` handlers staring at unknown shapes and forced each
// adapter's `handleWebhook` to do its own ad-hoc casting — every provider
// that survived signature verification but failed JSON parsing produced a
// `{ raw: '…' }` row that downstream code happily ran with.
//
// The fix is two-part:
//   1. Reject non-JSON bodies at the route layer with HTTP 400 (the route
//      will not call into this module for the rare legitimate non-JSON
//      payload, e.g. Slack form-encoded `payload=` body — those are
//      special-cased before reaching us).
//   2. Validate the parsed JSON against a per-provider Zod schema before
//      persisting. The schemas are intentionally permissive — they verify
//      "this looks like a real webhook from this provider" rather than
//      asserting every nested field. Stricter parsing happens inside the
//      adapter's `handleWebhook` after the delivery is queued.
//
// To register a schema for a new provider:
//   1. Add the slug to the `KNOWN_PROVIDERS` list and define a permissive
//      schema in `WEBHOOK_PAYLOAD_SCHEMAS`. Aim for shape-only validation:
//      object with one or two distinguishing fields the provider always
//      includes (event id, type, etc).
//   2. Unknown providers fall back to a "must be a JSON object/array"
//      check — that already eliminates the `{ raw: '...' }` poison-pill
//      case while leaving room for adapters that haven't been audited yet.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Per-provider schemas
// ---------------------------------------------------------------------------

/**
 * Slack webhooks are either JSON `event_callback` envelopes or form-encoded
 * `payload=` interactivity bodies. The route parses the form variant before
 * reaching us, so the validated shape is always JSON with at least a `type`
 * field (Slack guarantees this on every payload).
 */
const slackWebhookSchema = z
  .object({
    type: z.string().min(1),
  })
  .passthrough();

/**
 * Resend uses the Svix envelope format — at minimum `type` (e.g.
 * `email.delivered`) and `data` (the event body). Both are always present.
 */
const resendWebhookSchema = z
  .object({
    type: z.string().min(1),
    data: z.unknown(),
  })
  .passthrough();

/**
 * Jira sends `webhookEvent` (e.g. `jira:issue_updated`) on every
 * dynamically-registered webhook; `timestamp` is always present.
 */
const jiraWebhookSchema = z
  .object({
    webhookEvent: z.string().min(1),
  })
  .passthrough();

/**
 * Linear webhooks always carry an `action` and a `type`.
 */
const linearWebhookSchema = z
  .object({
    action: z.string().min(1),
    type: z.string().min(1),
  })
  .passthrough();

/**
 * DocuSign Connect payloads carry an `event` field (e.g.
 * `recipient-completed`) plus a `data` object describing the envelope.
 */
const docusignWebhookSchema = z
  .object({
    event: z.string().optional(),
    data: z
      .object({
        envelopeId: z.string().optional(),
      })
      .passthrough()
      .optional(),
    envelopeId: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough()
  .refine(
    payload => Boolean(payload.envelopeId ?? payload.data?.envelopeId),
    'DocuSign webhook missing envelopeId',
  );

/**
 * Autenti webhook events declare an `eventType` and an `id` (provider event
 * id) per the Autenti integration docs.
 */
const autentiWebhookSchema = z
  .object({
    eventType: z.string().min(1),
  })
  .passthrough();

/**
 * Storecove e-invoice lifecycle webhooks always include `eventType` and a
 * `metadata.guid` for dedup.
 */
const storecoveWebhookSchema = z
  .object({
    eventType: z.string().min(1),
    metadata: z
      .object({
        guid: z.string().min(1).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const WEBHOOK_PAYLOAD_SCHEMAS: Readonly<Record<string, z.ZodTypeAny>> = {
  slack: slackWebhookSchema,
  resend: resendWebhookSchema,
  jira: jiraWebhookSchema,
  linear: linearWebhookSchema,
  docusign: docusignWebhookSchema,
  autenti: autentiWebhookSchema,
  storecove: storecoveWebhookSchema,
};

/**
 * Permissive fallback for providers without an explicit schema. Rejects
 * obvious garbage (primitives, `null`, the `{ raw: '...' }` poison pill the
 * old route emitted) but accepts arbitrary JSON objects / arrays.
 */
const FALLBACK_SCHEMA = z
  .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
  .refine(payload => {
    if (Array.isArray(payload)) return true;
    // Reject the `{ raw: '...' }` shape — that's the legacy fallback emitted
    // when JSON.parse failed; we want a hard rejection so it never reaches
    // adapters that assume real webhook shape.
    const keys = Object.keys(payload);
    if (keys.length === 1 && keys[0] === 'raw') return false;
    return true;
  }, 'webhook payload does not look like a valid event');

export interface WebhookValidationSuccess {
  ok: true;
  payload: unknown;
}

export interface WebhookValidationFailure {
  ok: false;
  reason: string;
}

export type WebhookValidationResult = WebhookValidationSuccess | WebhookValidationFailure;

/**
 * Validate a parsed webhook payload against the per-provider schema.
 * Returns `{ ok: true, payload }` on success and `{ ok: false, reason }`
 * on failure. The route layer rejects with HTTP 400 on failure.
 *
 * Unknown providers run the fallback "must be a JSON object/array" check.
 *
 * @param provider — slug from the [provider] route segment
 * @param payload  — parsed JSON (the route MUST do JSON.parse first)
 */
export function validateWebhookPayload(
  provider: string,
  payload: unknown,
): WebhookValidationResult {
  const schema = WEBHOOK_PAYLOAD_SCHEMAS[provider] ?? FALLBACK_SCHEMA;
  const parsed = schema.safeParse(payload);
  if (parsed.success) return { ok: true, payload: parsed.data };
  // Format the first error path for the rejection log; full details stay
  // out of the public response so we don't leak internals to senders.
  const issue = parsed.error.issues[0];
  const where = issue?.path.join('.') ?? 'root';
  return {
    ok: false,
    reason: `${where}: ${issue?.message ?? 'invalid'}`,
  };
}

/**
 * For tests + introspection — returns the registered slugs.
 */
export function getRegisteredWebhookProviders(): string[] {
  return Object.keys(WEBHOOK_PAYLOAD_SCHEMAS);
}
