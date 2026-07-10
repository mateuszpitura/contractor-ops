// Canonical typed enqueue helper for QStash jobs.
//
// Before this module: every producer hand-rolled
// `getQStashClient().publishJSON({...})` with mismatched retries (2 vs 3),
// timeouts, dedup IDs, and URL conventions across 6+ files. There was no
// payload-shape registry, so a producer renaming a field could silently
// drift from its consumer.
//
// After: every producer calls `enqueueJob('jobName', payload, opts?)`.
// `JobRegistry` ties the job name to its payload shape, the destination
// route, and the per-job retry/timeout defaults. Consumers re-derive the
// same shape from the same registry.
//
// Idempotency: when callers pass `dedupId`, it becomes the
// `Upstash-Deduplication-Id` header so QStash short-circuits duplicate
// publishes within its 1-day dedup window.

import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';

const log = createLogger({ service: 'queue' });

// ---------------------------------------------------------------------------
// Job registry
// ---------------------------------------------------------------------------

/**
 * Per-job typed payload contract. Add a new entry here when introducing a
 * new QStash topic; the registry types both producer and consumer side.
 */
export interface JobRegistry {
  'webhook.process': { deliveryId: string; provider: string };
  'ocr.process': { extractionId: string; organizationId: string; storageKey: string };
  'ksef.sync': { organizationId: string; connectionId: string };
  'google-workspace.sync': { organizationId: string; connectionId: string };
  'peppol.outbound': {
    organizationId: string;
    invoiceId: string;
    receiverParticipantId: string;
  };
  'peppol.inbound': { organizationId: string; transmissionId: string };
  'peppol.poll': { organizationId?: string };
  'late-interest.render-claim-pdf': { claimId: string; organizationId: string };
  'zatca.submit': {
    organizationId: string;
    invoiceId: string;
    attempt?: number;
  };
  'outbox.drain': Record<string, never>;
  'webhook.deliver': { attemptId: string };
}

export type JobName = keyof JobRegistry;

interface JobConfig {
  /** Path component appended to API_URL (apps/api Fastify host). */
  route: string;
  /** Default QStash retry attempts. Per-call override allowed. */
  retries: number;
  /** Default per-attempt timeout. Per-call override allowed. */
  timeout?: string;
}

/**
 * Per-job defaults. Routes match the Fastify handlers registered on
 * `apps/api` (no `/api/` prefix — see apps/api/src/routes + the webhook
 * plugin in apps/api/src/routes/webhooks/index.ts).
 */
const JOB_CONFIG: Record<JobName, JobConfig> = {
  'webhook.process': { route: '/webhooks/_process', retries: 3 },
  'ocr.process': { route: '/ocr/_process', retries: 3, timeout: '60s' },
  'ksef.sync': { route: '/ksef/_sync', retries: 5 },
  'google-workspace.sync': { route: '/google-workspace/_sync', retries: 5 },
  'peppol.outbound': { route: '/peppol/outbound', retries: 5 },
  'peppol.inbound': { route: '/peppol/inbound', retries: 3 },
  'peppol.poll': { route: '/peppol/poll', retries: 3 },
  'late-interest.render-claim-pdf': {
    route: '/late-interest/_render-claim-pdf',
    retries: 3,
    timeout: '60s',
  },
  'zatca.submit': { route: '/zatca/_submit', retries: 3 },
  'outbox.drain': { route: '/outbox/_drain', retries: 3 },
  // The DB row owns the authoritative webhook backoff; QStash retries are a thin
  // safety net for the route itself crashing (the handler returns 200 even on a
  // delivery failure, which it records + re-enqueues).
  'webhook.deliver': { route: '/webhooks-outbound/_deliver', retries: 2 },
};

// ---------------------------------------------------------------------------
// Producer API
// ---------------------------------------------------------------------------

/**
 * The subset of QStash's publish request we populate. `timeout`/`delay` are
 * plain strings/numbers here; QStash's own type narrows them to typed
 * duration template-literals, so the value is cast at the `publishJSON`
 * boundary in {@link enqueueJob}.
 */
interface QStashPublishRequest {
  url: string;
  body: JobRegistry[JobName];
  retries: number;
  timeout?: string;
  deduplicationId?: string;
  notBefore?: number;
  delay?: number;
}

export interface EnqueueJobOptions {
  /** Override the registry-default retries. */
  retries?: number;
  /** Override the registry-default timeout (Upstash duration format, e.g. '60s'). */
  timeout?: string;
  /**
   * Upstash QStash deduplication id (24h window). Use a stable per-job
   * identity such as the OutboxEvent.id or a sha256 of (orgId, businessKey,
   * operation). Two publishes with the same dedupId within the window are
   * collapsed to one delivery.
   */
  dedupId?: string;
  /** Schedule the message for the future (Upstash `notBefore`, unix seconds). */
  notBefore?: number;
  /** Delay before first delivery (seconds). */
  delaySeconds?: number;
}

/**
 * Publishes a typed job to the canonical QStash topic for `name`.
 *
 * Returns the QStash messageId for trace correlation. Throws if QStash
 * publish fails — callers must decide whether to wrap in try/catch (e.g.
 * fire-and-forget reaper jobs) or let the exception propagate (e.g.
 * mission-critical submission jobs that should fail the user request).
 */
export async function enqueueJob<TName extends JobName>(
  name: TName,
  payload: JobRegistry[TName],
  opts: EnqueueJobOptions = {},
): Promise<{ messageId: string }> {
  const config = JOB_CONFIG[name];
  const url = `${getServerEnv().API_URL}${config.route}`;
  const retries = opts.retries ?? config.retries;
  const timeout = opts.timeout ?? config.timeout;

  const request: QStashPublishRequest = {
    url,
    body: payload,
    retries,
  };
  if (timeout) request.timeout = timeout;
  if (opts.dedupId) request.deduplicationId = opts.dedupId;
  if (opts.notBefore) request.notBefore = opts.notBefore;
  if (opts.delaySeconds) request.delay = opts.delaySeconds;

  // Upstash's `publishJSON` narrows `delay`/`timeout` to typed duration
  // template-literals (`${bigint}s` etc.). Our overrides come from the typed
  // registry above, so we cast at this one boundary and let QStash validate
  // the duration strings at runtime.
  const result = (await getQStashClient().publishJSON(
    request as Parameters<ReturnType<typeof getQStashClient>['publishJSON']>[0],
  )) as { messageId: string };

  log.debug({ jobName: name, messageId: result.messageId, dedupId: opts.dedupId }, 'job enqueued');
  return { messageId: result.messageId };
}
