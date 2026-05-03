import { processOcrExtraction } from '@contractor-ops/api/services/ocr-extraction';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import {
  buildContextFromHeaders,
  createCronLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Error classification — F-ASYNC-16
// ---------------------------------------------------------------------------
//
// Pre-fix: every uncaught error returned 500, so QStash retried until DLQ on
// permanently-bad PDFs (corrupt, unsupported format) — burning credits and
// flooding logs. The service-level `processOcrExtraction` already marks the
// row FAILED via its own try/catch on permanent errors, so reaching the
// route catch is the rare "something blew up before the service could
// classify" case (R2 download fail, OOM, cold-start crash). Treat those as
// transient → 5xx → QStash retry.
//
// For the common "service caught and marked FAILED" path: the service does
// NOT throw, so we return 200. Only true transient infra failures retry.

function classifyOcrError(err: unknown): { status: number; reason: 'permanent' | 'transient' } {
  if (!(err instanceof Error)) return { status: 500, reason: 'transient' };
  const msg = err.message.toLowerCase();
  // Validation / corrupt PDF / unsupported format / R2 404: permanent.
  if (
    msg.includes('not found') ||
    msg.includes('invalid pdf') ||
    msg.includes('unsupported') ||
    msg.includes('corrupt') ||
    msg.includes('400') ||
    msg.includes('404')
  ) {
    return { status: 200, reason: 'permanent' };
  }
  // Default: transient (Anthropic 5xx, R2 5xx, network).
  return { status: 500, reason: 'transient' };
}

// ---------------------------------------------------------------------------
// Ensure adapters are registered
// ---------------------------------------------------------------------------

registerAllAdapters();

const log = createCronLogger('ocr-process');

const ocrProcessBodySchema = z.object({
  extractionId: z.string().min(1),
  organizationId: z.string().min(1),
  storageKey: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /api/ocr/_process
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for async OCR processing.
 *
 * Verified via QStash signature (QSTASH_CURRENT_SIGNING_KEY,
 * QSTASH_NEXT_SIGNING_KEY).
 */
async function handler(request: NextRequest) {
  // F-OBS-03: reseed ALS frame from upstream QStash forward headers so logs
  // from this consumer correlate with the producer's tRPC procedure span.
  const ctx = buildContextFromHeaders(request.headers);
  return runWithRequestContext(ctx, async () => {
    const rawBody = await request.json().catch(() => null);
    const parsed = ocrProcessBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
      const detail =
        missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
      return NextResponse.json({ error: detail }, { status: 400 });
    }
    const { extractionId, organizationId, storageKey } = parsed.data;

    try {
      await processOcrExtraction({
        extractionId,
        organizationId,
        storageKey,
      });

      return NextResponse.json({ processed: true });
    } catch (error) {
      // F-ASYNC-16: only true infra failures should retry. The
      // processOcrExtraction service already catches+FAILS the row for
      // permanent OCR errors and does NOT rethrow, so reaching here is rare
      // (R2 outage, runtime crash, OOM). Classify and either retry or
      // permanently fail.
      const classified = classifyOcrError(error);
      log.error(
        { err: error, extractionId, classification: classified.reason },
        'ocr processing failed at route boundary',
      );
      if (classified.reason === 'permanent') {
        Sentry.captureException(error, {
          tags: { 'ocr.outcome': 'permanent-failure' },
          extra: { extractionId, organizationId },
        });
      }
      return NextResponse.json(
        { error: 'Processing failed', classification: classified.reason },
        { status: classified.status },
      );
    }
  });
}

export const POST = verifySignatureAppRouter(handler);
