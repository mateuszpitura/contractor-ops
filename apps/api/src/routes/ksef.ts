/**
 * KSeF sync worker (`POST /ksef/_sync`).
 */

import { processKsefSync } from '@contractor-ops/api/services/ksef-sync-orchestrator';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { createCronLogger } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { defineQStashRoute } from '../lib/qstash-route.js';

const log = createCronLogger('ksef-sync');

const ksefSyncBodySchema = z.object({
  organizationId: z.string().min(1),
  connectionId: z.string().min(1),
});

registerAllAdapters();

export function registerKsefSyncRoute(app: FastifyInstance): void {
  defineQStashRoute(app, {
    path: '/ksef/_sync',
    observabilityName: 'ksef-sync',
    bodySchema: ksefSyncBodySchema,
    handler: async (body, { reply }) => {
      const { organizationId, connectionId } = body;
      try {
        const result = await processKsefSync({ organizationId, connectionId });
        return reply.code(200).send({ processed: true, ...result });
      } catch (error) {
        log.error({ err: error, organizationId }, 'ksef sync failed');
        return reply.code(500).send({ error: 'KSeF sync failed' });
      }
    },
  });
}
