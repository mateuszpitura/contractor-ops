import { prisma } from "@contractor-ops/db";
import type { Prisma } from "@contractor-ops/db/generated/prisma/client";
import { extractInvoice } from "@contractor-ops/integrations/services/ocr-service";
import { getQStashClient } from "@contractor-ops/integrations/services/qstash-client";
import { createLogger } from "@contractor-ops/logger";
import { metrics } from "@contractor-ops/logger/metrics";
import * as Sentry from "@sentry/nextjs";
import { checkAndDeductCredit } from "./credit-service.js";
import { createPresignedDownloadUrl } from "./r2.js";

const log = createLogger({ service: "ocr" });

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
}): Promise<
  { extractionId: string } | { error: "no_subscription" | "credits_exhausted"; remaining: number }
> {
  // Credit check per BILL-06 -- hard-block when exhausted
  const creditResult = await checkAndDeductCredit(params.organizationId);
  if (!creditResult.allowed) {
    return {
      error: creditResult.reason ?? "credits_exhausted",
      remaining: creditResult.remaining,
    };
  }

  const extraction = await prisma.ocrExtraction.create({
    data: {
      organizationId: params.organizationId,
      documentId: params.documentId,
      invoiceId: params.invoiceId ?? null,
      provider: "CLAUDE",
      status: "PENDING",
    },
  });

  const qstash = getQStashClient();
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/ocr/_process`,
    body: {
      extractionId: extraction.id,
      organizationId: params.organizationId,
      storageKey: params.storageKey,
    },
    retries: 2,
    timeout: "60s",
  });

  log.info(
    { extractionId: extraction.id, organizationId: params.organizationId },
    "ocr extraction triggered",
  );
  metrics.increment("ocr.triggered", 1, {
    organizationId: params.organizationId,
  });

  return { extractionId: extraction.id };
}

/**
 * Processes an OCR extraction job (called by QStash callback).
 *
 * 1. Updates status to PROCESSING
 * 2. Fetches PDF from R2 via presigned download URL
 * 3. Sends to OCR adapter for extraction
 * 4. Persists results (or error) in the OcrExtraction record
 */
export async function processOcrExtraction(params: {
  extractionId: string;
  organizationId: string;
  storageKey: string;
}): Promise<void> {
  // Mark as processing
  await prisma.ocrExtraction.update({
    where: { id: params.extractionId },
    data: { status: "PROCESSING" },
  });

  try {
    // Fetch PDF from R2
    const downloadUrl = await createPresignedDownloadUrl(params.storageKey);
    const pdfResponse = await fetch(downloadUrl);

    if (!pdfResponse.ok) {
      throw new Error(
        `Failed to download PDF from R2: ${pdfResponse.status} ${pdfResponse.statusText}`,
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const pdfBase64 = pdfBuffer.toString("base64");

    // Extract invoice data via OCR adapter
    const result = await extractInvoice({
      provider: "CLAUDE",
      pdfBase64,
      fileName: params.storageKey,
      locale: "pl",
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
      "ocr extraction completed",
    );
    metrics.increment("ocr.completed", 1, { status: result.status });
    if (result.processingTimeMs) {
      metrics.distribution("ocr.processing_time", result.processingTimeMs, {
        unit: "millisecond",
      });
    }
    if (result.overallConfidence != null) {
      metrics.distribution("ocr.confidence", result.overallConfidence);
    }
  } catch (error) {
    log.error({ err: error, extractionId: params.extractionId }, "ocr extraction failed");
    Sentry.captureException(error, {
      tags: { "ocr.extraction_id": params.extractionId },
    });
    metrics.increment("ocr.failed");

    // Mark as failed
    await prisma.ocrExtraction.update({
      where: { id: params.extractionId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown processing error",
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
    orderBy: { createdAt: "desc" },
  });
}
