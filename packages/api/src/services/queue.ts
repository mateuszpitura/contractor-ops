// Canonical typed enqueue helper for QStash jobs (P2-A, F-ASYNC-02).
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
    submissionId: string;
  };
  'outbox.drain': Record<string, never>;
}

export type JobName = keyof JobRegistry;

interface JobConfig {
  /** Path component appended to NEXT_PUBLIC_APP_URL. */
  route: string;
  /** Default QStash retry attempts. Per-call override allowed. */
  retries: number;
  /** Default per-attempt timeout. Per-call override allowed. */
  timeout?: string;
}

/**
 * Per-job defaults. Values cribbed from the audit's "Queue consumer matrix"
 * (.audit-2026-05-03/04-async.md) so we don't regress existing call-site
 * behaviour while consolidating the shape.
 */
const JOB_CONFIG: Record<JobName, JobConfig> = {
  'webhook.process': { route: '/api/webhooks/_process', retries: 3 },
  'ocr.process': { route: '/api/ocr/_process', retries: 3, timeout: '60s' },
  'ksef.sync': { route: '/api/ksef/_sync', retries: 5 },
  'google-workspace.sync': { route: '/api/google-workspace/_sync', retries: 5 },
  'peppol.outbound': { route: '/api/peppol/outbound', retries: 5 },
  'peppol.inbound': { route: '/api/peppol/inbound', retries: 3 },
  'peppol.poll': { route: '/api/peppol/poll', retries: 3 },
  'late-interest.render-claim-pdf': {
    route: '/api/late-interest/_render-claim-pdf',
    retries: 3,
    timeout: '60s',
  },
  'zatca.submit': { route: '/api/zatca/_submit', retries: 3 },
  'outbox.drain': { route: '/api/outbox/_drain', retries: 3 },
};

// ---------------------------------------------------------------------------
// Producer API
// ---------------------------------------------------------------------------

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
  const url = `${getServerEnv().NEXT_PUBLIC_APP_URL}${config.route}`;
  const retries = opts.retries ?? config.retries;
  const timeout = opts.timeout ?? config.timeout;

  // Upstash's PublishRequest type narrows `delay` and `timeout` to typed
  // duration template-literal strings (`${bigint}s` etc.). Our string-typed
  // overrides come from a typed registry above, so widening to `unknown` and
  // letting QStash validate at runtime is safe — and keeps the producer API
  // ergonomic.
  // biome-ignore lint/suspicious/noExplicitAny: QStash typed-duration narrowing
  const request: any = {
    url,
    body: payload,
    retries,
  };
  if (timeout) request.timeout = timeout;
  if (opts.dedupId) request.deduplicationId = opts.dedupId;
  if (opts.notBefore) request.notBefore = opts.notBefore;
  if (opts.delaySeconds) request.delay = opts.delaySeconds;

  const result = (await getQStashClient().publishJSON(request)) as { messageId: string };

  log.debug({ jobName: name, messageId: result.messageId, dedupId: opts.dedupId }, 'job enqueued');
  return { messageId: result.messageId };
}
