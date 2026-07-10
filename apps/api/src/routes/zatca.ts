/**
 * ZATCA submission worker (`POST /zatca/_submit`).
 *
 *   1. QStash signature verification via `defineQStashRoute`.
 *   2. Reseed ALS frame from upstream QStash headers.
 *   3. Wrap with `withQueueObservability('zatca-submit', …)` for the
 *      per-tick duration histogram.
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
import { findAcrossRegions } from '@contractor-ops/db';
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
        // Fast-path idempotency: once `submittedAt` is set the ZATCA network
        // call already settled this invoice, so skip re-running it. (A still-
        // PENDING row with no `submittedAt` is a transient failure — that is
        // safe to resubmit; `submitToZatca` reuses the row instead of
        // recreating it, so the @unique(invoiceId) P2002 no longer applies.)
        const located = await findAcrossRegions(async client => {
          const row = await client.zatcaInvoiceChain.findUnique({
            where: { invoiceId },
            select: { zatcaStatus: true },
          });
          return row ?? null;
        });
        const existing = located?.result;

        const terminalSuccess = new Set(['CLEARED', 'REPORTED', 'WARNING']);
        if (existing && terminalSuccess.has(existing.zatcaStatus)) {
          log.info(
            { invoiceId, organizationId, status: existing.zatcaStatus },
            'zatca submission already settled, skipping',
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
