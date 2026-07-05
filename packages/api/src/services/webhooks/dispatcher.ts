/**
 * Per-delivery outbound-webhook dispatcher.
 *
 * The outbox fan-out handler (see `../outbox/handlers.ts`) persists one
 * `WebhookDeliveryAttempt` per matching subscription and enqueues a
 * `webhook.deliver` job. THIS module owns the actual send, mirroring the outbox
 * CLAIM → DISPATCH → FINALIZE structure but with the webhook backoff + DLQ:
 *
 *   1. CAS-claim the attempt (PENDING|FAILED → SENDING).
 *   2. Kill switch — nothing egresses unless `module.outbound-webhooks` is on.
 *   3. Per-sub 100/min rate limit — over-limit → requeue (throttle, not drop).
 *   4. SSRF re-check + sign + POST via the DNS-rebind-guarded agent (10s, no redirects).
 *   5. FINALIZE — 2xx → DELIVERED; else schedule the next attempt on the fixed
 *      backoff, or dead-letter to `webhook_failures` after the max.
 *
 * Every step is wrapped so a poison row is isolated and never stalls siblings.
 */

import http from 'node:http';
import https from 'node:https';

import { prisma } from '@contractor-ops/db';
import { evaluate } from '@contractor-ops/feature-flags';
import { createLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/node';

import { enqueueJob } from '../queue.js';
import { assertWebhookUrlSafe, webhookHttpAgent, webhookHttpsAgent } from './ssrf-guard.js';
import { getWebhookSecret } from './secret-store.js';
import { signWebhookPayload } from './signer.js';

const log = createLogger({ service: 'webhook-dispatcher' });

/** Fixed retry backoff: 1m, 5m, 30m, 2h, 12h, 24h. */
export const WEBHOOK_BACKOFF_SCHEDULE_MS = [
  60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 86_400_000,
] as const;

/** Max delivery attempts before dead-lettering. */
export const WEBHOOK_MAX_ATTEMPTS = 6;

const REQUEUE_DELAY_SECONDS = 5;
const REQUEST_TIMEOUT_MS = 10_000;
const WEBHOOK_FAILURE_ALERT_THRESHOLD = 5;

type NextAttempt = { action: 'retry'; delayMs: number } | { action: 'dead-letter' };

/**
 * Given the number of attempts just completed, decide whether to retry (and the
 * delay before the next attempt) or dead-letter. The schedule index is clamped
 * so the last entry is the steady-state cap.
 */
export function nextWebhookAttempt(
  completedAttempts: number,
  maxRetries: number = WEBHOOK_MAX_ATTEMPTS,
): NextAttempt {
  if (completedAttempts >= maxRetries) return { action: 'dead-letter' };
  const index = Math.min(Math.max(0, completedAttempts - 1), WEBHOOK_BACKOFF_SCHEDULE_MS.length - 1);
  const delayMs =
    WEBHOOK_BACKOFF_SCHEDULE_MS[index] ??
    WEBHOOK_BACKOFF_SCHEDULE_MS[WEBHOOK_BACKOFF_SCHEDULE_MS.length - 1] ??
    86_400_000;
  return { action: 'retry', delayMs };
}

function moduleOutboundWebhooksEnabled(organizationId: string, region: string): boolean {
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const);
  return evaluate('module.outbound-webhooks', { organizationId, region: evalRegion }).enabled;
}

interface PostResult {
  status: number;
}

/** POST a body with the DNS-rebind-guarded agent. `https.request` never follows
 * redirects, so a 302 → metadata is returned as a non-2xx, never chased. */
function postWebhook(
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<PostResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const agent = isHttps ? webhookHttpsAgent : webhookHttpAgent;

    const req = transport.request(
      url,
      { method: 'POST', agent, headers, timeout: REQUEST_TIMEOUT_MS },
      res => {
        res.resume(); // drain — we only need the status
        res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('webhook request timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fireFailureAlertIfNeeded(organizationId: string): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentFailures = await prisma.webhookDeliveryAttempt.count({
    where: {
      organizationId,
      status: { in: ['FAILED', 'DEAD'] },
      createdAt: { gte: oneHourAgo },
    },
  });
  if (recentFailures >= WEBHOOK_FAILURE_ALERT_THRESHOLD) {
    const msg = `Outbound webhook alert: ${recentFailures} delivery failures for org in the last hour (threshold: ${WEBHOOK_FAILURE_ALERT_THRESHOLD})`;
    log.error({ organizationId, recentFailures }, msg);
    Sentry.captureMessage(msg, {
      level: 'error',
      tags: { 'webhook.outcome': 'failure_threshold' },
      extra: { organizationId, recentFailures },
    });
  }
}

interface AttemptRow {
  id: string;
  subscriptionId: string;
  organizationId: string;
  eventType: string;
  payloadJson: unknown;
  attempts: number;
  createdAt: Date;
  subscription: {
    id: string;
    url: string;
    httpAllowed: boolean;
    includePii: boolean;
    maxRetries: number;
    secretEncrypted: string;
  };
}

async function scheduleNextOrDeadLetter(
  attempt: AttemptRow,
  responseStatus: number | null,
  error: string,
): Promise<void> {
  const completed = attempt.attempts + 1;
  const decision = nextWebhookAttempt(completed, attempt.subscription.maxRetries);

  if (decision.action === 'retry') {
    await prisma.webhookDeliveryAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'FAILED',
        attempts: completed,
        responseStatus,
        lastError: error.slice(0, 1000),
        nextAttemptAt: new Date(Date.now() + decision.delayMs),
      },
    });
    await enqueueJob(
      'webhook.deliver',
      { attemptId: attempt.id },
      { delaySeconds: Math.ceil(decision.delayMs / 1000), dedupId: `${attempt.id}:${completed}` },
    );
  } else {
    await prisma.$transaction([
      prisma.webhookDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'DEAD',
          attempts: completed,
          responseStatus,
          lastError: error.slice(0, 1000),
        },
      }),
      prisma.webhookDeadLetter.create({
        data: {
          subscriptionId: attempt.subscriptionId,
          organizationId: attempt.organizationId,
          attemptId: attempt.id,
          eventType: attempt.eventType,
          payloadJson: attempt.payloadJson as never,
          lastError: error.slice(0, 1000),
          attempts: completed,
        },
      }),
      prisma.webhookSubscription.update({
        where: { id: attempt.subscriptionId },
        data: { lastFailureAt: new Date() },
      }),
    ]);
  }

  await fireFailureAlertIfNeeded(attempt.organizationId);
}

/**
 * Deliver one attempt. Safe to call repeatedly (CAS claim). Never throws — a
 * poison row is caught, recorded, and isolated so sibling deliveries proceed.
 */
export async function deliverAttempt(attemptId: string): Promise<void> {
  // CAS claim.
  const claim = await prisma.webhookDeliveryAttempt.updateMany({
    where: { id: attemptId, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'SENDING' },
  });
  if (claim.count === 0) return; // already claimed / delivered / dead

  const attempt = (await prisma.webhookDeliveryAttempt.findUnique({
    where: { id: attemptId },
    include: { subscription: true },
  })) as AttemptRow | null;
  if (!attempt) return;

  try {
    // Kill switch — nothing egresses unless the org is granted the module.
    const org = await prisma.organization.findUnique({
      where: { id: attempt.organizationId },
      select: { dataRegion: true },
    });
    if (!moduleOutboundWebhooksEnabled(attempt.organizationId, org?.dataRegion ?? 'EU')) {
      await prisma.webhookDeliveryAttempt.update({
        where: { id: attempt.id },
        data: { status: 'PENDING', lastError: 'outbound-webhooks disabled' },
      });
      return;
    }

    // Per-sub dispatch rate limit — over-limit → requeue (throttle, not drop).
    const { overDispatchRateLimit } = await import('./rate-limit.js');
    if (await overDispatchRateLimit(attempt.subscriptionId)) {
      await prisma.webhookDeliveryAttempt.update({
        where: { id: attempt.id },
        data: { status: 'PENDING' },
      });
      await enqueueJob(
        'webhook.deliver',
        { attemptId: attempt.id },
        { delaySeconds: REQUEUE_DELAY_SECONDS, dedupId: `${attempt.id}:throttle:${Date.now()}` },
      );
      return;
    }

    // SSRF re-check (DNS rebinding) immediately before connect.
    await assertWebhookUrlSafe(attempt.subscription.url, {
      httpAllowed: attempt.subscription.httpAllowed,
    });

    const secret = getWebhookSecret(attempt.subscription);
    const envelope = {
      id: attempt.id,
      type: attempt.eventType,
      created_at: attempt.createdAt.toISOString(),
      organization_id: attempt.organizationId,
      data: attempt.payloadJson,
      include_pii: attempt.subscription.includePii,
    };
    const raw = JSON.stringify(envelope);
    const t = Date.now();
    const { header } = signWebhookPayload(secret, raw, t);

    const result = await postWebhook(attempt.subscription.url, raw, {
      'Content-Type': 'application/json',
      'X-CO-Event': attempt.eventType,
      'X-CO-Webhook-Id': attempt.subscriptionId,
      'X-CO-Delivery': attempt.id,
      'X-CO-Signature': header,
      'User-Agent': 'ContractorOps-Webhooks/1.0',
    });

    if (result.status >= 200 && result.status < 300) {
      await prisma.$transaction([
        prisma.webhookDeliveryAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'DELIVERED',
            attempts: attempt.attempts + 1,
            responseStatus: result.status,
            deliveredAt: new Date(),
            lastError: null,
          },
        }),
        prisma.webhookSubscription.update({
          where: { id: attempt.subscriptionId },
          data: { lastSuccessAt: new Date() },
        }),
      ]);
      return;
    }

    await scheduleNextOrDeadLetter(attempt, result.status, `non-2xx response: ${result.status}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err, attemptId: attempt.id }, 'webhook delivery failed');
    await scheduleNextOrDeadLetter(attempt, null, message);
  }
}
