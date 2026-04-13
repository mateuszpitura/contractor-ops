import { prisma } from '@contractor-ops/db';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { getAdapter } from '@contractor-ops/integrations/registry';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { extractSlackTeamId, resolveSlackConnectionByTeamId } from '../slack-webhook-context.js';

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

  const verification = adapter.verifyWebhookSignature?.(rawBody, headers);
  if (!verification?.valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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
        payloadJson = payloadStr ? JSON.parse(payloadStr) : {};
      }
    } else {
      payloadJson = JSON.parse(rawBody);
    }
  } catch {
    payloadJson = { raw: rawBody.slice(0, 10000) };
  }

  let resolvedOrgId = verification.organizationId ?? '';
  let resolvedConnectionId = verification.connectionId ?? null;

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
    const org = await prisma.organization.findUnique({
      where: { slug: verification.organizationSlug },
      select: { id: true },
    });
    if (org) {
      resolvedOrgId = org.id;
    }
  }

  if (provider === 'resend' && !resolvedOrgId) {
    console.warn(
      `[webhook/resend] Skipping WebhookDelivery: unresolved organization (slug=${verification.organizationSlug ?? 'none'})`,
    );
    return NextResponse.json({ received: true, persisted: false });
  }

  if (!resolvedOrgId) {
    console.warn(`[webhook/${provider}] Skipping WebhookDelivery: missing organizationId`);
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

  try {
    const qstash = getQStashClient();
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/_process`,
      body: { deliveryId: delivery.id, provider },
      retries: 3,
    });
  } catch (queueError) {
    console.error(`[webhook/${provider}] Failed to queue for processing:`, queueError);
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
