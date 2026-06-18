/**
 * Async export download endpoint.
 *
 *   1. Better Auth session must resolve.
 *   2. Session's `activeOrganizationId` must match `Export.organizationId`
 *      (defense-in-depth on top of Prisma tenant scope).
 *   3. Export row must be READY with a non-expired R2 key.
 *   4. Sign a 5-min URL via `@contractor-ops/api/services/r2` and 302
 *      redirect — the original "export ready" email link can outlive any
 *      single presigned URL without leaking a long-lived secret.
 *
 * GET routes are exempt from the CSRF origin guard, so no special
 * exemption is needed here.
 */

import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { claimExport, runExportHandler } from '@contractor-ops/api/services/exports';
import {
  BackpressureRoutes,
  isBackpressureRejected,
  withBackpressure,
} from '@contractor-ops/api/services/qstash-backpressure';
import { signExistingDownload } from '@contractor-ops/api/services/r2';
import { auth } from '@contractor-ops/auth';
import { prisma } from '@contractor-ops/db';
import { createCronLogger, createLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../lib/qstash-verify.js';

const log = createLogger({ service: 'exports-download' });

const SIGNED_URL_TTL_SECONDS = 5 * 60;

export function registerExportsRoute(app: FastifyInstance): void {
  app.get<{ Params: { exportId: string } }>(
    '/exports/:exportId/download',
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sequential auth → tenant-match → status/expiry guards → presign orchestration; each step gates the next with its own error response, so splitting would scatter the request lifecycle.
    async (request, reply) => {
      reply.header('cache-control', 'no-store, private');

      const fwdHeaders = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') fwdHeaders.set(key, value);
        else if (Array.isArray(value)) fwdHeaders.set(key, value.join(','));
      }

      const session = await auth.api.getSession({ headers: fwdHeaders });
      if (!session) return reply.code(401).send({ error: 'unauthenticated' });
      const activeOrgId = session.session.activeOrganizationId;
      if (!activeOrgId) return reply.code(403).send({ error: 'no active organization' });

      const { exportId } = request.params;
      const row = await prisma.export.findUnique({
        where: { id: exportId },
        select: {
          id: true,
          organizationId: true,
          status: true,
          fileR2Key: true,
          fileName: true,
          mimeType: true,
          expiresAt: true,
        },
      });

      if (!row || row.organizationId !== activeOrgId) {
        return reply.code(404).send({ error: 'not found' });
      }

      if (row.status !== 'READY' || !row.fileR2Key) {
        return reply.code(409).send({ error: 'export not ready', status: row.status });
      }

      if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
        return reply.code(410).send({ error: 'export expired' });
      }

      try {
        const { signedUrl } = await signExistingDownload(
          row.fileR2Key,
          SIGNED_URL_TTL_SECONDS,
          row.fileName ?? undefined,
        );
        return reply.redirect(signedUrl, 302);
      } catch (err) {
        log.error(
          { err: err instanceof Error ? err.message : String(err), exportId },
          'export download URL signing failed',
        );
        return reply.code(500).send({ error: 'sign failed' });
      }
    },
  );
}

// ---------------------------------------------------------------------------
// /exports/_process — QStash callback for the async export framework.
// ---------------------------------------------------------------------------

const processLog = createCronLogger('exports-process');

const processBodySchema = z.object({
  exportId: z.string().min(1),
  organizationId: z.string().min(1),
});

async function processHandlerInner(
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

  const parsed = processBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid body' });
  }
  const { exportId } = parsed.data;

  let claim: Awaited<ReturnType<typeof claimExport>>;
  try {
    claim = await claimExport(exportId);
  } catch (err) {
    processLog.error(
      { err: err instanceof Error ? err.message : String(err), exportId },
      'export claim failed',
    );
    // 500 → QStash retries (transient Neon hiccup).
    return reply.code(500).send({ error: 'claim failed' });
  }

  if (!claim) {
    // Row vanished — retention sweep deleted before QStash fired.
    // Success-style response so QStash doesn't loop.
    processLog.warn({ exportId }, 'export row not found — skipping');
    return reply.code(200).send({ skipped: true });
  }

  if (claim.alreadyProcessed) {
    processLog.info({ exportId }, 'export already processed — skipping');
    return reply.code(200).send({ skipped: true });
  }

  try {
    await runExportHandler(claim);
    return reply.code(200).send({ processed: true });
  } catch (err) {
    processLog.error(
      { err: err instanceof Error ? err.message : String(err), exportId },
      'export handler failed',
    );
    // 500 → QStash retries. The handler already marked the row FAILED;
    // on retry `claimExport` short-circuits on the status guard.
    return reply.code(500).send({ error: 'handler failed' });
  }
}

export function registerExportsProcessRoute(app: FastifyInstance): void {
  app.post('/exports/_process', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    const { key, max } = BackpressureRoutes.EXPORTS_PROCESS;
    return guard.run(async () => {
      try {
        return await withBackpressure(key, max, () =>
          withQueueObservability(key, () => processHandlerInner(request, reply, guard.rawBody)),
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
