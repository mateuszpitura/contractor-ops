/**
 * Google Workspace directory sync (`POST /google-workspace/_sync`).
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. Reseed ALS frame.
 *   3. `withQueueObservability('google-workspace-sync', …)`.
 *   4. Validate body shape (`organizationId`, `connectionId`).
 *   5. Delegate to `processDirectorySync` — compares the directory,
 *      detects changes, notifies admins.
 *   6. 200 on success; 500 on error → QStash retries.
 *
 * Called by daily cron schedule (02:00 org timezone) and manual
 * `googleWorkspace.triggerSync` tRPC. Exempt from CSRF origin guard via
 * `/google-workspace/` prefix.
 */

import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { processDirectorySync } from '@contractor-ops/api/services/google-workspace-sync-orchestrator';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../lib/qstash-verify.js';

const log = createCronLogger('google-workspace-sync');

const syncRequestBodySchema = z.object({
  organizationId: z.string().min(1),
  connectionId: z.string().min(1),
});

// Adapter registry is process-singleton.
registerAllAdapters();

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

  const parsed = syncRequestBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.flatten() });
  }
  const { organizationId, connectionId } = parsed.data;

  try {
    const result = await processDirectorySync({ organizationId, connectionId });
    return reply.code(200).send({ processed: true, ...result });
  } catch (error) {
    log.error({ err: error, organizationId }, 'failed to sync directory for org');
    return reply.code(500).send({ error: 'Google Workspace directory sync failed' });
  }
}

export function registerGoogleWorkspaceSyncRoute(app: FastifyInstance): void {
  app.post('/google-workspace/_sync', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    return guard.run(() =>
      withQueueObservability('google-workspace-sync', () =>
        handlerInner(request, reply, guard.rawBody),
      ),
    );
  });
}
