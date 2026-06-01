/**
 * Contract health-check QStash callback (`POST /contract-health/_run`).
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. F-SCALE-19 — `withBackpressure(CONTRACT_HEALTH_RUN)` caps fleet-wide
 *      concurrency so an Anthropic spike doesn't sink other QStash consumers.
 *   3. F-ASYNC-17 — `withQueueObservability` reports per-tick duration.
 *   4. Validate body shape (organizationId, contractId, triggeredBy, …).
 *   4. Delegate to `runContractHealthCheck`; the service persists a FAILED
 *      ContractHealthCheckRun row on failure so operators can diagnose and
 *      re-run from the admin UI.
 *   5. Always 200 — the run's own status (SUCCEEDED/FAILED/DEDUPED) is the
 *      source of truth; returning non-2xx would trigger QStash retry storms
 *      that create duplicate runs.
 *
 * Phase 75 D-01. Enqueued from `contract.create` (UPLOAD) and
 * `contract.rerunHealthCheck` (MANUAL/MODEL_BUMP_BULK). Lives inside the
 * webhook plugin scope so the raw-body parser delivers the bytes QStash's
 * HMAC was computed over.
 */

import { runContractHealthCheck } from '@contractor-ops/api/services/contract-health';
import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import {
  BackpressureRoutes,
  isBackpressureRejected,
  withBackpressure,
} from '@contractor-ops/api/services/qstash-backpressure';
import { prisma } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../lib/qstash-verify.js';

const log = createCronLogger('contract-health-run');

const bodySchema = z.object({
  organizationId: z.string().min(1),
  contractId: z.string().min(1),
  triggeredBy: z.enum(['UPLOAD', 'MANUAL', 'MODEL_BUMP_BULK']),
  triggeredByUserId: z.string().min(1).nullish(),
  force: z.boolean().optional(),
});

async function handlerInner(
  _request: FastifyRequest,
  reply: FastifyReply,
  rawBody: string,
): Promise<FastifyReply> {
  let parsedJson: unknown;
  try {
    parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    parsedJson = null;
  }

  const parsed = bodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return reply.code(400).send({ error: detail });
  }
  const body = parsed.data;

  try {
    const result = await runContractHealthCheck({
      db: prisma,
      organizationId: body.organizationId,
      contractId: body.contractId,
      triggeredBy: body.triggeredBy,
      triggeredByUserId: body.triggeredByUserId ?? null,
      force: body.force,
    });
    log.info(
      {
        runId: result.runId,
        status: result.status,
        verdict: result.verdict,
        contractId: body.contractId,
      },
      'contract health-check completed',
    );
    return reply.code(200).send({ ok: true, runId: result.runId, status: result.status });
  } catch (error) {
    // runContractHealthCheck already persisted a FAILED row; return 200 to
    // prevent QStash retry storms. Failed runs are re-runnable from the UI.
    log.error(
      { err: error instanceof Error ? error.message : String(error), contractId: body.contractId },
      'contract health-check failed before a run row could be persisted',
    );
    return reply.code(200).send({ ok: false, error: 'health-check failed' });
  }
}

export function registerContractHealthRoute(app: FastifyInstance): void {
  app.post('/contract-health/_run', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    const { key, max } = BackpressureRoutes.CONTRACT_HEALTH_RUN;
    return guard.run(async () => {
      try {
        return await withBackpressure(key, max, () =>
          withQueueObservability(key, () => handlerInner(request, reply, guard.rawBody)),
        );
      } catch (err) {
        if (isBackpressureRejected(err)) {
          return reply.code(429).header('Retry-After', String(err.retryAfterSec)).send();
        }
        throw err;
      }
    });
  });
}
