/**
 * Multi-provider webhook dispatcher.
 *
 * Provider-agnostic ingress: resolves the adapter by slug, verifies the
 * webhook signature, schema-validates the body, persists a WebhookDelivery
 * row + queues a follow-up QStash job for async processing in /webhooks/_process.
 *
 * Per-connection-secret providers (jira/linear): each tenant stores its own
 * signing secret in `IntegrationConnection.configJson.webhookSecret`. The
 * route iterates connected integrations and tries each secret until one
 * verifies. It NEVER trusts an inbound
 * `x-webhook-secret` header.
 *
 * Slack / Resend: org resolution falls back to a workspace/teamId lookup
 * (Slack) or a slug lookup (Resend). Both hit the Upstash cache via
 * `resolveSlackConnectionByTeamId` / `resolveOrgIdBySlug`.
 *
 * QStash publish failures leave the WebhookDelivery row RECEIVED (error
 * recorded) and still return 2xx so the provider does not redeliver. The row
 * is durable and un-processed, so the job-health reaper replays it on its
 * normal stale-RECEIVED backoff — FAILED is reserved for terminal reaper
 * exhaustion, so a transient publish failure must not pre-empt it there.
 *
 * Duplicate upstream deliveries collapse via the DB-unique on
 * (provider, providerEventId): the second insert hits P2002 and the route
 * 200-OKs it as idempotent.
 */

import { prisma } from '@contractor-ops/db';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { getAdapter } from '@contractor-ops/integrations/registry';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { validateWebhookPayload } from '@contractor-ops/integrations/services/webhook-schemas';
import type { WebhookVerificationResult } from '@contractor-ops/integrations/types';
import { createWebhookLogger, getRequestId } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../../env.js';
import { Sentry } from '../../lib/sentry.js';
import {
  extractSlackTeamId,
  resolveOrgIdBySlug,
  resolveSlackConnectionByTeamId,
} from '../../lib/webhooks/slack-webhook-context.js';

const log = createWebhookLogger('generic');

const PER_CONNECTION_SECRET_PROVIDERS = new Set(['jira', 'linear']);

/** Prisma unique-constraint violation (used for webhook-delivery dedup). */
function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

interface ConnectionConfigWithWebhookSecret {
  webhookSecret?: string | null;
}

function providerSlugToEnum(slug: string): string {
  return slug.toUpperCase();
}

async function verifyPerConnection(
  providerSlug: string,
  rawBody: string,
  headers: Record<string, string>,
  verifyFn: (
    body: string,
    hdrs: Record<string, string>,
    secret: string | null,
  ) => WebhookVerificationResult,
): Promise<{
  verification: WebhookVerificationResult;
  organizationId?: string;
  connectionId?: string;
}> {
  const connections = await prisma.integrationConnection.findMany({
    where: {
      provider: providerSlugToEnum(providerSlug) as never,
      status: 'CONNECTED',
    },
    select: {
      id: true,
      organizationId: true,
      configJson: true,
    },
  });

  if (connections.length === 0) {
    return { verification: { valid: false, reason: 'config' } };
  }

  let lastFailure: WebhookVerificationResult = { valid: false, reason: 'config' };

  for (const conn of connections) {
    const config = (conn.configJson ?? null) as ConnectionConfigWithWebhookSecret | null;
    const secret = config?.webhookSecret ?? null;
    if (!secret) continue;

    const result = verifyFn(rawBody, headers, secret);
    if (result.valid) {
      return {
        verification: result,
        organizationId: conn.organizationId,
        connectionId: conn.id,
      };
    }
    lastFailure = result;
  }

  return { verification: lastFailure };
}

/** Project Fastify's header bag to a flat `Record<string, string>`. */
function collectStringHeaders(
  rawHeaders: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (typeof value === 'string') headers[key] = value;
    else if (Array.isArray(value)) headers[key] = value.join(',');
  }
  return headers;
}

type ParsedWebhookBody = { ok: true; payload: unknown } | { ok: false; status: 400; error: string };

/**
 * Parse the raw webhook body. Slack may arrive as JSON or as a form-encoded
 * `payload` field; every other provider is plain JSON. Returns a discriminated
 * result so the caller maps a failure to the right HTTP response.
 */
function parseWebhookBody(provider: string, rawBody: string): ParsedWebhookBody {
  try {
    if (provider === 'slack') {
      const trimmed = rawBody.trim();
      if (trimmed.startsWith('{')) {
        return { ok: true, payload: JSON.parse(trimmed) };
      }
      const formParams = new URLSearchParams(rawBody);
      const payloadStr = formParams.get('payload');
      if (!payloadStr) {
        log.warn({ provider }, 'rejected webhook: slack form body missing payload field');
        return { ok: false, status: 400, error: 'Invalid payload' };
      }
      return { ok: true, payload: JSON.parse(payloadStr) };
    }
    return { ok: true, payload: JSON.parse(rawBody) };
  } catch (parseErr) {
    log.warn(
      {
        provider,
        err: parseErr instanceof Error ? parseErr.message : String(parseErr),
        requestId: getRequestId(),
      },
      'rejected webhook: unparseable JSON body',
    );
    return { ok: false, status: 400, error: 'Invalid JSON' };
  }
}

type ResolvedWebhookOrg = { orgId: string; connectionId: string | null } | { skip: true };

type OrgCandidate = { orgId: string; connectionId: string | null };

/** Slack fallback: resolve the org/connection from the payload's teamId. */
async function applySlackOrgFallback(
  current: OrgCandidate,
  payloadJson: unknown,
): Promise<OrgCandidate> {
  if (current.orgId) return current;
  const teamId = extractSlackTeamId(payloadJson);
  if (!teamId) return current;
  const resolved = await resolveSlackConnectionByTeamId(teamId);
  if (!resolved) return current;
  return {
    orgId: resolved.organizationId,
    connectionId: current.connectionId ?? resolved.connectionId,
  };
}

/** Resend fallback: resolve the org from the verification's organization slug. */
async function applyResendOrgFallback(
  current: OrgCandidate,
  organizationSlug: string | undefined,
): Promise<OrgCandidate> {
  if (current.orgId || !organizationSlug) return current;
  const orgId = await resolveOrgIdBySlug(organizationSlug);
  return orgId ? { ...current, orgId } : current;
}

/**
 * Resolve the organization (and optional connection) the delivery belongs to.
 * Falls back to a Slack teamId / Resend slug lookup. Returns `{ skip: true }`
 * (after logging) when the org cannot be resolved — the caller answers 2xx
 * without persisting so the provider does not redeliver.
 */
async function resolveWebhookOrg(
  provider: string,
  verification: WebhookVerificationResult,
  payloadJson: unknown,
  perConnectionOrgId: string | undefined,
  perConnectionConnectionId: string | undefined,
): Promise<ResolvedWebhookOrg> {
  let candidate: OrgCandidate = {
    orgId: perConnectionOrgId ?? verification.organizationId ?? '',
    connectionId: perConnectionConnectionId ?? verification.connectionId ?? null,
  };

  if (provider === 'slack') {
    candidate = await applySlackOrgFallback(candidate, payloadJson);
  }

  if (provider === 'resend') {
    candidate = await applyResendOrgFallback(candidate, verification.organizationSlug);
    if (!candidate.orgId) {
      log.warn(
        { provider, slug: verification.organizationSlug ?? null },
        'skipping WebhookDelivery: unresolved organization',
      );
      return { skip: true };
    }
  }

  if (!candidate.orgId) {
    log.warn({ provider }, 'skipping WebhookDelivery: missing organizationId');
    return { skip: true };
  }

  return { orgId: candidate.orgId, connectionId: candidate.connectionId };
}

/**
 * Queue the delivery for async processing. On QStash failure, safe-swallow:
 * mark the row FAILED + report to Sentry but never throw, so the caller still
 * returns 2xx and the provider does not redeliver.
 */
async function enqueueWebhookProcessing(deliveryId: string, provider: string): Promise<void> {
  try {
    const qstash = getQStashClient();
    await qstash.publishJSON({
      url: `${loadEnv().API_URL}/webhooks/_process`,
      body: { deliveryId, provider },
      retries: 3,
    });
  } catch (queueError) {
    log.error(
      {
        err: queueError,
        provider,
        deliveryId,
        requestId: getRequestId(),
      },
      'failed to queue for processing',
    );
    Sentry.captureException(queueError, {
      tags: { 'webhook.provider': provider, 'webhook.stage': 'qstash-publish' },
      extra: { deliveryId, requestId: getRequestId() },
    });
    // Keep the row RECEIVED (do NOT flip to FAILED): the event was accepted
    // but never handed to the async processor, which is exactly the
    // stale-RECEIVED case the reaper replays. FAILED is terminal from the
    // reaper's perspective, so flipping here would park the row. Record the
    // error so on-call has a fingerprint on the still-replayable row.
    const message =
      `QStash publish failed: ${queueError instanceof Error ? queueError.message : String(queueError)}`.slice(
        0,
        500,
      );
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        lastErrorAt: new Date(),
        lastError: message,
        errorMessage: message,
      },
    });
  }
}

/** Coerce a Fastify raw body (Buffer or string) to a UTF-8 string. */
function extractRawBody(body: unknown): string {
  if (body instanceof Buffer) return body.toString('utf8');
  if (typeof body === 'string') return body;
  return '';
}

type WebhookAdapter = NonNullable<ReturnType<typeof getAdapter>>;

/**
 * Verify the inbound signature. Per-connection-secret providers (jira/linear)
 * try each tenant's stored secret; everyone else uses the adapter's static
 * verifier. Returns the verification result plus any org/connection it bound.
 */
async function verifyWebhookRequest(
  provider: string,
  adapter: WebhookAdapter,
  rawBody: string,
  headers: Record<string, string>,
): Promise<{
  verification: WebhookVerificationResult | undefined;
  organizationId?: string;
  connectionId?: string;
}> {
  if (PER_CONNECTION_SECRET_PROVIDERS.has(provider) && adapter.verifyWebhookSignature) {
    const verifyFn = adapter.verifyWebhookSignature.bind(adapter);
    return verifyPerConnection(provider, rawBody, headers, verifyFn);
  }
  return { verification: adapter.verifyWebhookSignature?.(rawBody, headers) };
}

// Adapter registry is process-singleton — register once at module load.
registerAllAdapters();

export function registerMultiProviderWebhookRoute(app: FastifyInstance): void {
  app.post<{ Params: { provider: string } }>('/webhooks/:provider', async (request, reply) => {
    const { provider } = request.params;
    const adapter = getAdapter(provider);

    if (!adapter?.supportsWebhooks) {
      return reply.code(404).send({ error: 'Unknown provider' });
    }

    const rawBody = extractRawBody(request.body);

    const headers = collectStringHeaders(request.headers);

    const {
      verification,
      organizationId: perConnectionOrgId,
      connectionId: perConnectionConnectionId,
    } = await verifyWebhookRequest(provider, adapter, rawBody, headers);

    if (!verification?.valid) {
      log.warn(
        { provider, reason: verification?.reason ?? 'unknown' },
        'rejected webhook: signature verification failed',
      );
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    const isSlackViewSubmission = provider === 'slack' && rawBody.includes('view_submission');

    const parsedBody = parseWebhookBody(provider, rawBody);
    if (!parsedBody.ok) {
      return reply.code(parsedBody.status).send({ error: parsedBody.error });
    }
    let payloadJson: unknown = parsedBody.payload;

    const schemaResult = validateWebhookPayload(provider, payloadJson);
    if (!schemaResult.ok) {
      log.warn(
        { provider, reason: schemaResult.reason },
        'rejected webhook: schema validation failed',
      );
      return reply.code(400).send({ error: 'Invalid payload' });
    }
    payloadJson = schemaResult.payload;

    const org = await resolveWebhookOrg(
      provider,
      verification,
      payloadJson,
      perConnectionOrgId,
      perConnectionConnectionId,
    );
    if ('skip' in org) {
      return reply.code(200).send({ received: true, persisted: false });
    }

    let delivery: { id: string };
    try {
      delivery = await prisma.webhookDelivery.create({
        data: {
          organizationId: org.orgId,
          provider: adapter.slug.toUpperCase() as never,
          eventType: verification.eventType ?? 'UNKNOWN',
          signatureValid: true,
          payloadJson: payloadJson as never,
          deliveryStatus: 'RECEIVED',
          integrationConnectionId: org.connectionId,
          providerEventId: verification.providerEventId ?? null,
        },
      });
    } catch (createErr) {
      // DB-enforced dedup on (provider, providerEventId): a duplicate upstream
      // delivery collapses to the first row (P2002 on the second insert). The
      // first request already enqueued processing, so this one is a no-op.
      if (isUniqueConstraintViolation(createErr)) {
        log.info(
          { provider, providerEventId: verification.providerEventId },
          'duplicate upstream webhook event — collapsed to existing delivery row',
        );
        return reply.code(200).send({ received: true, idempotent: true });
      }
      throw createErr;
    }

    // Safe-swallow: a QStash publish failure leaves the row RECEIVED (error
    // recorded) but we still return 2xx so the provider doesn't redeliver and
    // create a second WebhookDelivery row (the at-most-once-per-row invariant
    // `_process` relies on for claim-update idempotency); the reaper replays
    // the un-processed RECEIVED row.
    await enqueueWebhookProcessing(delivery.id, provider);

    if (isSlackViewSubmission) {
      return reply.code(200).send({ response_action: 'clear' });
    }

    return reply.code(200).send({ received: true });
  });
}
