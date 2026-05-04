import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { renderClaimPdf } from '@contractor-ops/api/services/late-payment-claim-pdf';
import {
  buildContextFromHeaders,
  createCronLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createCronLogger('late-interest-render-claim-pdf');

const bodySchema = z.object({
  claimId: z.string().min(1),
  organizationId: z.string().min(1),
});

/**
 * QStash callback for async late-payment claim PDF rendering.
 *
 * Triggered from `latePaymentInterest.claim` after the claim row has been
 * persisted with `pdfStatus: PENDING_RENDER`. Rendering + R2 upload runs
 * here off the tRPC hot path; the client polls `latePaymentInterest.downloadClaim`
 * until `pdfStatus === READY`.
 *
 * Verified via QStash signature (QSTASH_CURRENT_SIGNING_KEY /
 * QSTASH_NEXT_SIGNING_KEY). On failure the service marks the row FAILED
 * with a truncated error message so operators can diagnose without
 * digging through Sentry.
 */
async function handler(request: NextRequest) {
  // F-OBS-03: reseed ALS frame from upstream QStash forward headers.
  // S3-5 · F-ASYNC-17: emit per-tick duration to `job.duration` histogram.
  const traceCtx = buildContextFromHeaders(request.headers);
  return runWithRequestContext(traceCtx, () =>
    withQueueObservability('late-interest-render-claim-pdf', () => handlerInner(request)),
  );
}

async function handlerInner(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { claimId } = parsed.data;

  try {
    const result = await renderClaimPdf(claimId);
    return NextResponse.json({ processed: true, ...result });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), claimId },
      'claim pdf render failed',
    );
    // Return 500 so QStash retries per our configured retry policy.
    return NextResponse.json({ error: 'render failed' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
