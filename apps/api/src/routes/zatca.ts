/**
 * ZATCA submission worker (`POST /zatca/_submit`).
 *
 *   1. QStash signature verification via `defineQStashRoute`.
 *   2. Reseed ALS frame from upstream QStash headers (F-OBS-03).
 *   3. Wrap with `withQueueObservability('zatca-submit', …)` for the
 *      per-tick duration histogram (F-ASYNC-17).
 *   4. Validate body shape (`invoiceId`, `organizationId`, optional `attempt`).
 *   5. Idempotency short-circuit if a chain entry already records a
 *      submission (`zatcaInvoiceChain.submittedAt` is set).
 *   6. Delegate to `handleZatcaSubmissionJob` — returns normally on
 *      permanent errors (200, QStash stops retrying); throws on
 *      retryable ones (500, QStash retries with exponential backoff).
 *   7. Distinguish `ZatcaApiError` (retryable) from unknown errors so
 *      Sentry tagging stays meaningful.
 *
 * Exempt from CSRF origin guard — QStash sends with no Origin and the
 * signature verification is the actual authn here.
 */

import { handleZatcaSubmissionJob } from '@contractor-ops/api/services/zatca-submission';
import { prisma } from '@contractor-ops/db';
import { ZatcaApiError } from '@contractor-ops/einvoice';
import { createWebhookLogger } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { defineQStashRoute } from '../lib/qstash-route.js';

const log = createWebhookLogger('zatca-submit');

const zatcaSubmitBodySchema = z.object({
  invoiceId: z.string().min(1),
  organizationId: z.string().min(1),
  attempt: z.number().int().nonnegative().optional(),
});

export function registerZatcaSubmitRoute(app: FastifyInstance): void {
  defineQStashRoute(app, {
    path: '/zatca/_submit',
    observabilityName: 'zatca-submit',
    bodySchema: zatcaSubmitBodySchema,
    handler: async (body, { reply }) => {
      const { invoiceId, organizationId, attempt } = body;

      try {
        // Idempotency: chain row is created inside `submitToZatca`'s tx, so
        // when `submittedAt` is set the ZATCA network call already happened.
        // Re-running would either duplicate the API call or hit the
        // @unique(invoiceId) constraint with P2002.
        const existing = await prisma.zatcaInvoiceChain.findUnique({
          where: { invoiceId },
          select: { submittedAt: true, zatcaStatus: true },
        });

        if (existing?.submittedAt) {
          log.info(
            { invoiceId, organizationId, status: existing.zatcaStatus },
            'zatca submission already recorded, skipping',
          );
          return reply.code(200).send({ skipped: true, status: existing.zatcaStatus });
        }

        await handleZatcaSubmissionJob({ invoiceId, organizationId, attempt });

        return reply.code(200).send({ submitted: true });
      } catch (error) {
        if (error instanceof ZatcaApiError) {
          log.warn(
            {
              err: error,
              invoiceId,
              organizationId,
              statusCode: error.statusCode,
              errorType: error.errorType,
            },
            'zatca submission retryable error',
          );
          return reply.code(500).send({
            error: 'ZATCA submission retryable error',
            errorType: error.errorType,
          });
        }

        log.error({ err: error, invoiceId, organizationId }, 'zatca submission failed');
        return reply.code(500).send({ error: 'ZATCA submission failed' });
      }
    },
  });
}
