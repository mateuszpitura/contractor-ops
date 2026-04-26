import { processOcrExtraction } from '@contractor-ops/api/services/ocr-extraction';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { createCronLogger } from '@contractor-ops/logger';
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
  const rawBody = await request.json().catch(() => null);
  const parsed = ocrProcessBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
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
}

export const POST = verifySignatureAppRouter(handler);
