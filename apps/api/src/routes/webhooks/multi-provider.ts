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
 * QStash publish failures mark the WebhookDelivery row as FAILED and still
 * return 2xx so the provider does not redeliver (the row is durable; the
 * dead-letter replay cron picks it up).
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

// Adapter registry is process-singleton — register once at module load.
registerAllAdapters();

export function registerMultiProviderWebhookRoute(app: FastifyInstance): void {
  app.post<{ Params: { provider: string } }>(
    '/webhooks/:provider',
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: provider-specific branching ported 1:1 from legacy route
    async (request, reply) => {
      const { provider } = request.params;
      const adapter = getAdapter(provider);

      if (!adapter?.supportsWebhooks) {
        return reply.code(404).send({ error: 'Unknown provider' });
      }

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
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      const isSlackViewSubmission = provider === 'slack' && rawBody.includes('view_submission');

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
              return reply.code(400).send({ error: 'Invalid payload' });
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
        return reply.code(400).send({ error: 'Invalid JSON' });
      }

      const schemaResult = validateWebhookPayload(provider, payloadJson);
      if (!schemaResult.ok) {
        log.warn(
          { provider, reason: schemaResult.reason },
          'rejected webhook: schema validation failed',
        );
        return reply.code(400).send({ error: 'Invalid payload' });
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
        return reply.code(200).send({ received: true, persisted: false });
      }

      if (!resolvedOrgId) {
        log.warn({ provider }, 'skipping WebhookDelivery: missing organizationId');
        return reply.code(200).send({ received: true, persisted: false });
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

      // Safe-swallow: QStash publish failure marks the row FAILED but we
      // still return 2xx so the provider doesn't redeliver and create a
      // second WebhookDelivery row (the at-most-once-per-row invariant
      // `_process` relies on for claim-update idempotency).
      try {
        const qstash = getQStashClient();
        await qstash.publishJSON({
          url: `${loadEnv().API_URL}/webhooks/_process`,
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
        return reply.code(200).send({ response_action: 'clear' });
      }

      return reply.code(200).send({ received: true });
    },
  );
}
