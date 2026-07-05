import { prisma } from '@contractor-ops/db';
import type { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { evaluate } from '@contractor-ops/feature-flags';
import { fetchWithTimeout } from '@contractor-ops/integrations';
import { extractInvoice } from '@contractor-ops/integrations/services/ocr-service';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import type { BillingCreditDenialReason } from '@contractor-ops/validators';
import { billingCreditDenialReason, getServerEnv } from '@contractor-ops/validators';
import * as Sentry from '@sentry/node';
import { checkAndDeductCredit } from './credit-service';
import { createPresignedDownloadUrl } from './r2';

const log = createLogger({ service: 'ocr' });

// ---------------------------------------------------------------------------
// OCR Extraction Orchestrator
// ---------------------------------------------------------------------------

/**
 * Triggers an async OCR extraction job via QStash.
 *
 * Creates an OcrExtraction record with PENDING status and dispatches
 * a QStash job to the /api/ocr/_process callback endpoint.
 *
 * @returns The newly created extraction ID
 */
export async function triggerOcrExtraction(params: {
  organizationId: string;
  documentId: string;
  storageKey: string;
  invoiceId?: string;
}): Promise<{ extractionId: string } | { error: BillingCreditDenialReason; remaining: number }> {
  // Credit check per BILL-06 -- hard-block when exhausted
  const creditResult = await checkAndDeductCredit(params.organizationId);
  if (!creditResult.allowed) {
    return {
      error: creditResult.reason ?? billingCreditDenialReason.creditsExhausted,
      remaining: creditResult.remaining,
    };
  }

  const extraction = await prisma.ocrExtraction.create({
    data: {
      organizationId: params.organizationId,
      documentId: params.documentId,
      invoiceId: params.invoiceId ?? null,
      provider: 'CLAUDE',
      status: 'PENDING',
    },
  });

  const qstash = getQStashClient();
  await qstash.publishJSON({
    url: `${getServerEnv().API_URL}/ocr/_process`,
    body: {
      extractionId: extraction.id,
      organizationId: params.organizationId,
      storageKey: params.storageKey,
    },
    // Stable per-extraction dedup id so a QStash re-publish (or a duplicate
    // trigger) collapses to a single in-flight job — a second delivery would
    // otherwise re-run the Claude Vision call at cost.
    deduplicationId: `ocr-extraction:${extraction.id}`,
    retries: 2,
    timeout: '60s',
  });

  log.info(
    { extractionId: extraction.id, organizationId: params.organizationId },
    'ocr extraction triggered',
  );
  metrics.increment('ocr.triggered', 1, {
    organizationId: params.organizationId,
  });

  return { extractionId: extraction.id };
}

/**
 * Resolves the data region for an org from its immutable `dataRegion` column,
 * defaulting to EU. Used to pick the regional Unleash client when evaluating
 * the AI-parser kill-switch (the QStash callback carries no tenant context).
 */
async function resolveOrgRegion(organizationId: string): Promise<'EU' | 'ME' | 'US'> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { dataRegion: true },
  });
  return org?.dataRegion ?? 'EU';
}

/**
 * Processes an OCR extraction job (called by QStash callback).
 *
 * 1. Updates status to PROCESSING
 * 2. Honours the `killswitch.ai-invoice-parser` flag — when off, skips the AI
 *    call and marks the row for manual entry
 * 3. Fetches PDF from R2 via presigned download URL
 * 4. Sends to OCR adapter for extraction
 * 5. Persists results (or error) in the OcrExtraction record
 */
export async function processOcrExtraction(params: {
  extractionId: string;
  organizationId: string;
  storageKey: string;
}): Promise<void> {
  // Compare-and-swap claim: only a still-PENDING row is claimable. A QStash
  // redelivery of an already-processed job (EXTRACTED / FAILED / SKIPPED /
  // in-flight PROCESSING) claims nothing, so we abort before spending a second
  // Claude Vision call and before clobbering a completed result back to
  // PROCESSING. A flag-off retrigger creates a fresh PENDING row, so genuine
  // re-runs are unaffected.
  const claim = await prisma.ocrExtraction.updateMany({
    where: { id: params.extractionId, status: 'PENDING' },
    data: { status: 'PROCESSING' },
  });

  if (claim.count === 0) {
    log.info(
      { extractionId: params.extractionId, organizationId: params.organizationId },
      'ocr extraction already claimed or terminal; skipping redelivery',
    );
    return;
  }

  try {
    // Emergency kill-switch: when ops disables the AI invoice parser (or
    // Unleash is unreachable, since the flag is killWhenUnknown), skip the
    // Claude Vision call entirely. The upload is already persisted; we mark
    // the row SKIPPED (not FAILED) so the UI drops into manual-entry fallback
    // without tripping FAILED-handling (retry/alerts/red badge). A later
    // retrigger (flag re-enabled) creates a fresh PENDING row and can still
    // produce a real extraction. Evaluated at the org-context boundary so the
    // per-org Unleash targeting applies.
    const region = await resolveOrgRegion(params.organizationId);
    const parser = evaluate('killswitch.ai-invoice-parser', {
      organizationId: params.organizationId,
      region,
    });

    if (!parser.enabled) {
      await prisma.ocrExtraction.update({
        where: { id: params.extractionId },
        data: {
          status: 'SKIPPED',
          errorMessage: 'AI invoice parsing is disabled — enter invoice details manually.',
          completedAt: new Date(),
        },
      });

      log.info(
        {
          extractionId: params.extractionId,
          organizationId: params.organizationId,
          reason: parser.reason,
        },
        'ocr extraction skipped: ai-invoice-parser kill-switch off',
      );
      metrics.increment('ocr.skipped', 1, { reason: parser.reason });
      return;
    }

    // Fetch PDF from R2
    const downloadUrl = await createPresignedDownloadUrl(params.storageKey);
    // PDFs can be large — give the body read headroom.
    const pdfResponse = await fetchWithTimeout(downloadUrl, undefined, { timeoutMs: 60_000 });

    if (!pdfResponse.ok) {
      throw new Error(
        `Failed to download PDF from R2: ${pdfResponse.status} ${pdfResponse.statusText}`,
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const pdfBase64 = pdfBuffer.toString('base64');

    // Extract invoice data via OCR adapter
    const result = await extractInvoice({
      provider: 'CLAUDE',
      pdfBase64,
      fileName: params.storageKey,
      locale: 'pl',
    });

    // Persist results
    await prisma.ocrExtraction.update({
      where: { id: params.extractionId },
      data: {
        status: result.status,
        resultJson: result as unknown as Prisma.InputJsonValue,
        overallConfidence: result.overallConfidence,
        pageCount: result.pageCount,
        processingTimeMs: result.processingTimeMs,
        completedAt: new Date(),
        errorMessage: result.errorMessage ?? null,
      },
    });

    log.info(
      {
        extractionId: params.extractionId,
        status: result.status,
        confidence: result.overallConfidence,
        durationMs: result.processingTimeMs,
      },
      'ocr extraction completed',
    );
    metrics.increment('ocr.completed', 1, { status: result.status });
    if (result.processingTimeMs) {
      metrics.distribution('ocr.processing_time', result.processingTimeMs, {
        unit: 'millisecond',
      });
    }
    if (result.overallConfidence != null) {
      metrics.distribution('ocr.confidence', result.overallConfidence);
    }
  } catch (error) {
    log.error({ err: error, extractionId: params.extractionId }, 'ocr extraction failed');
    Sentry.captureException(error, {
      tags: { 'ocr.extraction_id': params.extractionId },
    });
    metrics.increment('ocr.failed');

    // Mark as failed
    await prisma.ocrExtraction.update({
      where: { id: params.extractionId },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown processing error',
        retryCount: { increment: 1 },
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Retrieves an extraction result by ID, scoped to organization.
 */
export async function getExtractionResult(params: {
  organizationId: string;
  extractionId: string;
}) {
  return prisma.ocrExtraction.findFirst({
    where: {
      id: params.extractionId,
      organizationId: params.organizationId,
    },
  });
}

/**
 * Retrieves the latest extraction for a document, scoped to organization.
 */
export async function getExtractionByDocument(params: {
  organizationId: string;
  documentId: string;
}) {
  return prisma.ocrExtraction.findFirst({
    where: {
      documentId: params.documentId,
      organizationId: params.organizationId,
    },
    orderBy: { createdAt: 'desc' },
  });
}
