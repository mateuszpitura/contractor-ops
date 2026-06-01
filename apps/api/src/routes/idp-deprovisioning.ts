/**
 * IdP deprovisioning saga step runner (`POST /idp-deprovisioning/_step-runner`).
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. Validate body shape (runId, stepId, organizationId, provider, stepKind, externalUserId).
 *   3. Resolve the org's regional tenant-scoped Prisma client.
 *   4. Delegate to `runDeprovisioningStep` — one independent step per QStash job
 *      (no Promise.allSettled; recomputeRunStatus derives the aggregate, D-02/Pitfall 10).
 *   5. 200 on success; 500 on error → QStash retries per the configured policy.
 *
 * Enqueued by `deprovisioning.startDeprovisioningRun` / `retryDeprovisioningStep`.
 * Lives inside the webhook plugin scope (raw-body + QStash HMAC over exact bytes).
 */

import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import {
  runDeprovisioningStep,
  StepOrgMismatchError,
  stepRunnerBodySchema,
} from '@contractor-ops/api/services/idp-deprovisioning-step-runner';
import { createTenantClientFrom, getRegionalClient, prisma } from '@contractor-ops/db';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { guardQStashRequest } from '../lib/qstash-verify.js';

// Adapter registry is process-singleton.
registerAllAdapters();

const log = createCronLogger('idp-deprovisioning-step-runner');

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

  const parsed = stepRunnerBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return reply.code(400).send({ error: detail });
  }
  const body = parsed.data;

  try {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: body.organizationId },
      select: { dataRegion: true },
    });
    const region = org.dataRegion ?? 'EU';
    const db = createTenantClientFrom(getRegionalClient(region));

    const result = await runDeprovisioningStep(db, body);
    return reply.code(200).send({ processed: true, ...result });
  } catch (err) {
    // StepOrgMismatchError is a non-retryable configuration error (77 WR-04):
    // return 400 so QStash does NOT retry the job.
    if (err instanceof StepOrgMismatchError) {
      log.error(
        { err: err.message, runId: body.runId, stepId: body.stepId },
        'deprovisioning step org mismatch — non-retryable',
      );
      return reply.code(400).send({ error: err.message });
    }
    log.error(
      {
        err: err instanceof Error ? err.message : String(err),
        runId: body.runId,
        stepId: body.stepId,
      },
      'deprovisioning step runner failed',
    );
    // 500 → QStash retries; the head-of-job MAX_ATTEMPTS guard short-circuits eventually.
    return reply.code(500).send({ error: 'step failed' });
  }
}

export function registerIdpDeprovisioningStepRunnerRoute(app: FastifyInstance): void {
  app.post('/idp-deprovisioning/_step-runner', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;
    return guard.run(() =>
      withQueueObservability('idp-deprovisioning-step-runner', () =>
        handlerInner(request, reply, guard.rawBody),
      ),
    );
  });
}
