import { handleZatcaSubmissionJob } from '@contractor-ops/api/services/zatca-submission';
import { prisma } from '@contractor-ops/db';
import { ZatcaApiError } from '@contractor-ops/einvoice';
import { createWebhookLogger } from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createWebhookLogger('zatca-submit');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const zatcaSubmitBodySchema = z.object({
  invoiceId: z.string().min(1),
  organizationId: z.string().min(1),
  attempt: z.number().int().nonnegative().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/zatca/_submit
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for ZATCA invoice submission.
 *
 * Producer: packages/api/src/services/zatca-submission.ts → queueZatcaSubmission
 *
 * Verified via QStash signature (QSTASH_CURRENT_SIGNING_KEY,
 * QSTASH_NEXT_SIGNING_KEY) so untrusted callers cannot trigger
 * submissions.
 *
 * Flow:
 * 1. Parse + validate payload (invoiceId, organizationId)
 * 2. Idempotency: short-circuit if a chain entry already exists with
 *    submittedAt set — re-running submitToZatca would create a second
 *    chain entry (the @unique on invoiceId would then throw P2002).
 * 3. Delegate to handleZatcaSubmissionJob which:
 *      - Returns normally on non-retryable / auth errors → we 200 here
 *        so QStash stops retrying.
 *      - Throws on retryable errors → we 500 here so QStash retries
 *        with exponential backoff (3 attempts per QSTASH_CONFIG).
 * 4. Unknown errors are logged with Sentry-friendly metadata. We return
 *    200 only for permanent failures we can identify; everything else
 *    is treated as transient (5xx) so the operator can investigate via
 *    QStash DLQ when retries exhaust.
 */
async function handler(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = zatcaSubmitBodySchema.safeParse(rawBody);

  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return NextResponse.json({ error: detail }, { status: 400 });
  }

  const { invoiceId, organizationId, attempt } = parsed.data;

  try {
    // Idempotency: skip work if a chain entry already records a successful
    // submission. The chain row is created inside submitToZatca's
    // transaction, so if `submittedAt` is set the network call to ZATCA
    // already happened; re-running would either (a) duplicate the API
    // call or (b) hit the @unique(invoiceId) constraint with P2002.
    const existing = await prisma.zatcaInvoiceChain.findUnique({
      where: { invoiceId },
      select: { submittedAt: true, zatcaStatus: true },
    });

    if (existing?.submittedAt) {
      log.info(
        { invoiceId, organizationId, status: existing.zatcaStatus },
        'zatca submission already recorded, skipping',
      );
      return NextResponse.json({ skipped: true, status: existing.zatcaStatus });
    }

    await handleZatcaSubmissionJob({ invoiceId, organizationId, attempt });

    return NextResponse.json({ submitted: true });
  } catch (error) {
    // ZatcaApiError is the typed boundary between retryable / permanent.
    // handleZatcaSubmissionJob already short-circuits non-retryable
    // errors and returns; anything that bubbles here is either
    // (a) a retryable ZATCA error → re-throw via 500, or
    // (b) an unexpected error (DB outage, missing cert, etc.) → 500.
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
      return NextResponse.json(
        { error: 'ZATCA submission retryable error', errorType: error.errorType },
        { status: 500 },
      );
    }

    log.error({ err: error, invoiceId, organizationId }, 'zatca submission failed');
    return NextResponse.json({ error: 'ZATCA submission failed' }, { status: 500 });
  }
}

// Wrap with QStash signature verification.
// Uses QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env vars.
export const POST = verifySignatureAppRouter(handler);
