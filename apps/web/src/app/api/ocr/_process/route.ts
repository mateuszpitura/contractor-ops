import { processOcrExtraction } from '@contractor-ops/api/services/ocr-extraction';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import {
  buildContextFromHeaders,
  createCronLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

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
      log.error({ err: error, extractionId }, 'ocr processing failed');
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  });
}

export const POST = verifySignatureAppRouter(handler);
