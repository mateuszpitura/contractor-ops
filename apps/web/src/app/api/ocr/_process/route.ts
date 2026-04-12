import { processOcrExtraction } from "@contractor-ops/api/services/ocr-extraction";
import { registerAllAdapters } from "@contractor-ops/integrations/adapters/register-all";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Ensure adapters are registered
// ---------------------------------------------------------------------------

registerAllAdapters();

// ---------------------------------------------------------------------------
// POST /api/ocr/_process
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for async OCR processing.
 *
 * Verified via QStash signature (QSTASH_CURRENT_SIGNING_KEY,
 * QSTASH_NEXT_SIGNING_KEY).
 *
 * Flow:
 * 1. QStash verifies its own signature (via verifySignatureAppRouter wrapper)
 * 2. Parse extraction parameters from body
 * 3. Call processOcrExtraction to fetch PDF, run OCR, and persist results
 * 4. Return 200 on success, 500 on error (QStash retries on non-2xx)
 */
async function handler(request: NextRequest) {
  const body = await request.json();
  const { extractionId, organizationId, storageKey } = body as {
    extractionId: string;
    organizationId: string;
    storageKey: string;
  };

  if (!extractionId || !organizationId || !storageKey) {
    return NextResponse.json(
      { error: "Missing extractionId, organizationId, or storageKey" },
      { status: 400 },
    );
  }

  try {
    await processOcrExtraction({
      extractionId,
      organizationId,
      storageKey,
    });

    return NextResponse.json({ processed: true });
  } catch (error) {
    console.error(`[ocr/_process] Failed to process extraction ${extractionId}:`, error);

    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// Wrap with QStash signature verification
// Uses QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env vars
export const POST = verifySignatureAppRouter(handler);
