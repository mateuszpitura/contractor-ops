import { prisma } from '@contractor-ops/db';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { getAdapter } from '@contractor-ops/integrations/registry';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { validateWebhookPayload } from '@contractor-ops/integrations/services/webhook-schemas';
import type { WebhookVerificationResult } from '@contractor-ops/integrations/types';
import { createWebhookLogger, getRequestId } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  extractSlackTeamId,
  resolveOrgIdBySlug,
  resolveSlackConnectionByTeamId,
} from '../slack-webhook-context';

const log = createWebhookLogger('generic');

// ---------------------------------------------------------------------------
// Per-connection signature verification (F-SEC-02 / F-SEC-03 / F-INT-08)
// ---------------------------------------------------------------------------

/**
 * Providers whose webhook signing secret is stored per-connection in
 * `IntegrationConnection.configJson.webhookSecret`. For these providers the
 * route MUST resolve the secret server-side and pass it to the adapter — it
 * MUST NEVER trust an inbound `x-webhook-secret` header (which would let any
 * caller supply their own secret + matching HMAC and pass verification).
 */
const PER_CONNECTION_SECRET_PROVIDERS = new Set(['jira', 'linear']);

/**
 * Per-connection `IntegrationConnection.configJson` shape we rely on for
 * webhook signing. Other fields (cloudId, teamIds, etc.) may exist but are
 * not relevant here. Annotation only — schema is untyped Json on the DB side.
 */
interface ConnectionConfigWithWebhookSecret {
  webhookSecret?: string | null;
}

/**
 * Map provider slug → IntegrationProvider enum value used in DB rows.
 */
function providerSlugToEnum(slug: string): string {
  return slug.toUpperCase();
}

/**
 * For per-connection-secret providers (jira / linear), iterate every CONNECTED
 * integration connection of that provider and try its `webhookSecret` against
 * the inbound payload. The first connection whose adapter verification returns
 * `valid: true` wins. Returns the resolved verification result + connection
 * context, or a failure verification result if nothing matches.
 *
 * Cost note: this is O(N) over all connections for the provider in the
 * platform. For very large tenant counts this can be replaced with a
 * webhook URL that includes the connectionId (e.g. `/api/webhooks/jira/<id>`)
 * so we read a single row. For now the iterative approach is correct and
 * keeps the public ingress URL stable.
 */
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
    // Skip connections that have not configured a webhook secret — passing
    // null to the adapter would just produce another `reason: 'config'`.
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

// ---------------------------------------------------------------------------
// Ensure adapters are registered
// ---------------------------------------------------------------------------

registerAllAdapters();

// ---------------------------------------------------------------------------
// POST /api/webhooks/[provider]
// ---------------------------------------------------------------------------

/**
 * Unified webhook ingestion route.
 *
 * Flow (per D-05, D-06):
 * 1. Resolve adapter by provider slug
 * 2. Verify webhook signature via adapter
 * 3. Log to WebhookDelivery table
 * 4. Queue for async processing via QStash
 * 5. Return 200 (or response_action for Slack view_submission)
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: provider-specific branching for Slack/Resend/org resolution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const adapter = getAdapter(provider);

  if (!adapter?.supportsWebhooks) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  // F-SEC-02 / F-SEC-03 / F-INT-08: For providers with per-connection signing
  // secrets (Jira, Linear) the route resolves the secret server-side from
  // `IntegrationConnection.configJson.webhookSecret` and never trusts the
  // inbound `x-webhook-secret` header. We try every connected integration's
  // secret until one verifies (org is identified by the verifying connection).
  let verification: WebhookVerificationResult | undefined;
  let perConnectionOrgId: string | undefined;
  let perConnectionConnectionId: string | undefined;

  if (PER_CONNECTION_SECRET_PROVIDERS.has(provider) && adapter.verifyWebhookSignature) {
    const verifyFn = adapter.verifyWebhookSignature.bind(adapter);
    const result = await verifyPerConnection(provider, rawBody, headers, verifyFn);
    verification = result.verification;
    perConnectionOrgId = result.organizationId;
    perConnectionConnectionId = result.connectionId;
  } else {
    verification = adapter.verifyWebhookSignature?.(rawBody, headers);
  }

  if (!verification?.valid) {
    log.warn(
      { provider, reason: verification?.reason ?? 'unknown' },
      'rejected webhook: signature verification failed',
    );
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const isSlackViewSubmission = provider === 'slack' && rawBody.includes('view_submission');

  // F-INT-07: parse the body strictly. Falling back to a `{ raw: ... }`
  // sentinel let malformed payloads survive into the WebhookDelivery table
  // where downstream `_process` handlers would happily run with garbage.
  // We now reject unparseable bodies with HTTP 400 (after signature
  // verification — the signed-but-malformed case is itself a bug worth
  // surfacing in monitors) and validate the parsed JSON against a
  // per-provider schema before persisting.
  let payloadJson: unknown;
  try {
    if (provider === 'slack') {
      const trimmed = rawBody.trim();
      if (trimmed.startsWith('{')) {
        payloadJson = JSON.parse(trimmed);
      } else {
        const formParams = new URLSearchParams(rawBody);
        const payloadStr = formParams.get('payload');
        if (!payloadStr) {
          log.warn({ provider }, 'rejected webhook: slack form body missing payload field');
          return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }
        payloadJson = JSON.parse(payloadStr);
      }
    } else {
      payloadJson = JSON.parse(rawBody);
    }
  } catch (parseErr) {
    log.warn(
      {
        provider,
        err: parseErr instanceof Error ? parseErr.message : String(parseErr),
        requestId: getRequestId(),
      },
      'rejected webhook: unparseable JSON body',
    );
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const schemaResult = validateWebhookPayload(provider, payloadJson);
  if (!schemaResult.ok) {
    log.warn(
      { provider, reason: schemaResult.reason },
      'rejected webhook: schema validation failed',
    );
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  payloadJson = schemaResult.payload;

  let resolvedOrgId = perConnectionOrgId ?? verification.organizationId ?? '';
  let resolvedConnectionId = perConnectionConnectionId ?? verification.connectionId ?? null;

  if (provider === 'slack') {
    const teamId = extractSlackTeamId(payloadJson);
    if (teamId && !resolvedOrgId) {
      const resolved = await resolveSlackConnectionByTeamId(teamId);
      if (resolved) {
        resolvedOrgId = resolved.organizationId;
        resolvedConnectionId = resolvedConnectionId ?? resolved.connectionId;
      }
    }
  }

  if (provider === 'resend' && verification.organizationSlug && !resolvedOrgId) {
    // F-SCALE-10 — `resolveOrgIdBySlug` is Redis-cached (60 s TTL) so the
    // hot Resend webhook path doesn't pay a Neon round-trip per event.
    const orgId = await resolveOrgIdBySlug(verification.organizationSlug);
    if (orgId) {
      resolvedOrgId = orgId;
    }
  }

  if (provider === 'resend' && !resolvedOrgId) {
    log.warn(
      { provider, slug: verification.organizationSlug ?? null },
      'skipping WebhookDelivery: unresolved organization',
    );
    return NextResponse.json({ received: true, persisted: false });
  }

  if (!resolvedOrgId) {
    log.warn({ provider }, 'skipping WebhookDelivery: missing organizationId');
    return NextResponse.json({ received: true, persisted: false });
  }

  const delivery = await prisma.webhookDelivery.create({
    data: {
      organizationId: resolvedOrgId,
      provider: adapter.slug.toUpperCase() as never,
      eventType: verification.eventType ?? 'UNKNOWN',
      signatureValid: true,
      payloadJson: payloadJson as never,
      deliveryStatus: 'RECEIVED',
      integrationConnectionId: resolvedConnectionId,
    },
  });

  // safe-swallow: QStash publish failure marks the WebhookDelivery row as
  // FAILED so the dead-letter replay cron picks it up; we intentionally
  // return 2xx to the upstream provider because the payload is already
  // signature-verified, schema-validated and durably persisted. Returning
  // non-2xx here would re-deliver the same event and produce a second
  // WebhookDelivery row (provider redelivery has no awareness of our DB id),
  // breaking the at-most-once-per-delivery-row invariant the _process
  // claim-update relies on.
  try {
    const qstash = getQStashClient();
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/_process`,
      body: { deliveryId: delivery.id, provider },
      retries: 3,
    });
  } catch (queueError) {
    log.error(
      {
        err: queueError,
        provider,
        deliveryId: delivery.id,
        requestId: getRequestId(),
      },
      'failed to queue for processing',
    );
    Sentry.captureException(queueError, {
      tags: { 'webhook.provider': provider, 'webhook.stage': 'qstash-publish' },
      extra: { deliveryId: delivery.id, requestId: getRequestId() },
    });
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        deliveryStatus: 'FAILED',
        errorMessage:
          `QStash publish failed: ${queueError instanceof Error ? queueError.message : String(queueError)}`.slice(
            0,
            500,
          ),
      },
    });
  }

  if (isSlackViewSubmission) {
    return NextResponse.json({ response_action: 'clear' });
  }

  return NextResponse.json({ received: true });
}
