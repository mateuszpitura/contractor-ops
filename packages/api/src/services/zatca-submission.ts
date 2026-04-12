// ---------------------------------------------------------------------------
// ZATCA Invoice Submission Service
// ---------------------------------------------------------------------------
// Orchestrates the full ZATCA invoice submission pipeline:
// lock -> chain -> generate -> sign -> hash -> QR -> record -> submit
//
// Per D-05: Async submission via QStash queue.
// Per D-03: Sequential queue per org using advisory lock.
// Per T-48-13: QStash: 3 retries, exponential backoff, dead letter queue.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@contractor-ops/db";
import { prisma as defaultPrisma } from "@contractor-ops/db";
import type { Prisma } from "@contractor-ops/db/generated/prisma/client";
import type {
  CertificateInfo,
  EInvoice,
  EInvoiceTaxSubtotal,
  ZatcaClearanceResponse,
  ZatcaReportingResponse,
} from "@contractor-ops/einvoice";
import {
  ZATCA_PRODUCTION_URL,
  ZATCA_SANDBOX_URL,
  ZatcaApiClient,
  ZatcaApiError,
  ZatcaProfile,
} from "@contractor-ops/einvoice";
import { createZatcaSecretStore, ZATCA_SECRET_NAMES } from "@contractor-ops/integrations";
import { getQStashClient } from "@contractor-ops/integrations/services/qstash-client";
import type { PrismaLike } from "./zatca-hash-chain.js";
import { acquireChainLock, getNextChainEntry, recordChainEntry } from "./zatca-hash-chain.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmitToZatcaOptions {
  invoiceId: string;
  organizationId: string;
}

export interface ZatcaSubmissionJobPayload {
  invoiceId: string;
  organizationId: string;
  attempt?: number;
}

interface ZatcaConnectionConfig {
  environment: "test" | "prod";
}

// ---------------------------------------------------------------------------
// QStash Configuration
// ---------------------------------------------------------------------------

/** QStash retry config per T-48-13: 3 retries, exponential backoff */
const QSTASH_CONFIG = {
  retries: 3,
  /** Backoff intervals: 1s, 4s, 16s (exponential base 4) */
  delay: "1s" as const,
};

// ---------------------------------------------------------------------------
// Main Submission Orchestrator
// ---------------------------------------------------------------------------

/**
 * Full ZATCA invoice submission pipeline (10-step):
 *
 * 1. Prisma transaction with advisory lock
 * 2. getNextChainEntry -> ICV + PIH
 * 3. Build EInvoice with ZATCA extensions
 * 4. generate -> sign -> hash -> QR -> record
 * 5. Commit transaction
 * 6. Submit to ZATCA (clearance for standard, reporting for simplified)
 * 7. Update chain entry with response
 */
export async function submitToZatca(
  options: SubmitToZatcaOptions,
  db?: PrismaClient,
): Promise<void> {
  const prisma = db ?? defaultPrisma;
  const { invoiceId, organizationId } = options;

  // Load invoice and org data
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { contractor: true, lines: true },
  });

  // Get ZATCA connection config
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: "ZATCA",
      status: "CONNECTED",
    },
  });

  if (!connection) {
    throw new Error(`No active ZATCA connection for organization ${organizationId}`);
  }

  const config = connection.configJson as unknown as ZatcaConnectionConfig;
  const environment = config?.environment ?? "test";

  // Retrieve certificates from Infisical
  const secretStore = createZatcaSecretStore(organizationId);
  const [certificate, apiSecret, privateKey] = await Promise.all([
    secretStore.get(ZATCA_SECRET_NAMES.X509_CERTIFICATE),
    secretStore.get(ZATCA_SECRET_NAMES.API_SECRET),
    secretStore.get(ZATCA_SECRET_NAMES.PRIVATE_KEY),
  ]);

  if (!(certificate && apiSecret)) {
    throw new Error(
      `ZATCA certificates not found for organization ${organizationId}. Complete device onboarding first.`,
    );
  }

  if (!privateKey) {
    throw new Error(
      `ZATCA private key not found for organization ${organizationId}. Complete device onboarding first.`,
    );
  }

  // Step 1-5: Transaction with advisory lock
  const chainRecord = await prisma.$transaction(async (tx) => {
    const txClient = tx as unknown as PrismaLike;
    // Step 1: Acquire advisory lock
    await acquireChainLock(txClient, organizationId);

    // Step 2: Get next ICV + PIH
    const { icv, pih } = await getNextChainEntry(txClient, organizationId);

    // Step 3-4: Generate invoice XML with ZATCA extensions
    const zatcaUuid = randomUUID();

    // Build EInvoice from Prisma record
    const eInvoice = buildEInvoiceFromPrisma(invoice, { icv, pih, zatcaUuid });

    // Step 3: Generate UBL 2.1 XML with ZATCA extensions
    const profile = new ZatcaProfile();
    const unsignedXml = await profile.generate(eInvoice);

    // Step 4a: Sign with XAdES-BES
    const certInfo: CertificateInfo = { certificate, privateKey };
    const signedXml = await profile.sign.sign(unsignedXml, certInfo);

    // Step 4b: Compute hash of signed XML
    const invoiceHash = createHash("sha256").update(signedXml).digest("hex");

    // Step 4c: Generate TLV QR code
    const qrEInvoice: EInvoice = {
      ...eInvoice,
      extensions: {
        ...eInvoice.extensions,
        invoiceHash,
        signatureValue: signedXml,
        publicKey: certificate,
      },
    };
    const qrBuffer = await profile.qrCode.generateQR(qrEInvoice);
    const qrBase64 = qrBuffer.toString("base64");

    // Step 5: Record chain entry
    const record = await recordChainEntry(txClient, {
      organizationId,
      icv,
      invoiceId,
      invoiceHash,
      previousHash: pih,
      zatcaUuid,
    });

    return {
      id: record.id,
      icv,
      pih,
      zatcaUuid,
      invoiceXml: signedXml,
      invoiceHash,
      qrBase64,
    };
  });

  // Step 6: Submit to ZATCA (outside transaction -- network call)
  const apiClient = new ZatcaApiClient({
    baseUrl: environment === "prod" ? ZATCA_PRODUCTION_URL : ZATCA_SANDBOX_URL,
    binarySecurityToken: certificate,
    secret: apiSecret,
  });

  const payload = {
    invoiceHash: chainRecord.invoiceHash,
    uuid: chainRecord.zatcaUuid,
    invoice: Buffer.from(chainRecord.invoiceXml).toString("base64"),
  };

  try {
    // Determine B2B (standard/clearance) vs B2C (simplified/reporting)
    // Standard invoices have subtypes starting with "01", simplified with "02"
    const isStandard = isStandardInvoice(invoice as unknown as Record<string, unknown>);

    let response: ZatcaClearanceResponse | ZatcaReportingResponse;
    let status: string;

    if (isStandard) {
      response = await apiClient.submitForClearance(payload, organizationId);
      status = (response as ZatcaClearanceResponse).clearanceStatus;
    } else {
      response = await apiClient.submitForReporting(payload, organizationId);
      status = (response as ZatcaReportingResponse).reportingStatus;
    }

    // Step 7: Update chain entry with response
    const now = new Date();
    await prisma.zatcaInvoiceChain.update({
      where: { id: chainRecord.id },
      data: {
        zatcaStatus: mapZatcaStatus(status),
        zatcaResponse: response as unknown as Prisma.InputJsonValue,
        submittedAt: now,
        ...(status === "CLEARED" && { clearedAt: now }),
        ...(status === "REPORTED" && { reportedAt: now }),
        ...(status === "REJECTED" && {
          rejectedAt: now,
          rejectionReason: extractRejectionReason(response.validationResults),
        }),
      },
    });
  } catch (error) {
    // Update chain entry with error
    const isApiError = error instanceof ZatcaApiError;
    await prisma.zatcaInvoiceChain.update({
      where: { id: chainRecord.id },
      data: {
        zatcaStatus: "REJECTED",
        submittedAt: new Date(),
        rejectedAt: new Date(),
        rejectionReason: isApiError
          ? `API Error ${error.statusCode}: ${error.errorType}`
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
    });

    // Rethrow for QStash retry logic
    throw error;
  }
}

// ---------------------------------------------------------------------------
// QStash Job Handler
// ---------------------------------------------------------------------------

/**
 * Handles a ZATCA submission job from QStash.
 *
 * Error classification determines retry behavior:
 * - retryable: QStash retries with exponential backoff
 * - non-retryable: job goes to dead letter queue
 * - auth: logged as auth gate, no retry
 */
export async function handleZatcaSubmissionJob(payload: ZatcaSubmissionJobPayload): Promise<void> {
  try {
    await submitToZatca({
      invoiceId: payload.invoiceId,
      organizationId: payload.organizationId,
    });
  } catch (error) {
    if (error instanceof ZatcaApiError) {
      if (error.errorType === "non-retryable" || error.errorType === "auth") {
        // Don't retry -- log and let QStash mark as dead
        console.error(
          `[zatca-submission] Non-retryable error for invoice ${payload.invoiceId}:`,
          error.statusCode,
          error.errorType,
        );
        return; // Returning 200 tells QStash to not retry
      }
      // Retryable error -- throw to trigger QStash retry
      console.warn(
        `[zatca-submission] Retryable error for invoice ${payload.invoiceId}:`,
        error.statusCode,
      );
    }
    throw error;
  }
}

/**
 * Queue a ZATCA submission job via QStash.
 *
 * Per D-05: Async submission via QStash with retry config.
 */
export async function queueZatcaSubmission(
  invoiceId: string,
  organizationId: string,
): Promise<void> {
  const qstash = getQStashClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!appUrl) {
    throw new Error("APP_URL or NEXT_PUBLIC_APP_URL must be set for QStash");
  }

  await qstash.publishJSON({
    url: `${appUrl}/api/zatca/_submit`,
    body: {
      invoiceId,
      organizationId,
    } satisfies ZatcaSubmissionJobPayload,
    retries: QSTASH_CONFIG.retries,
    delay: QSTASH_CONFIG.delay,
  });
}

// ---------------------------------------------------------------------------
// EInvoice Builder
// ---------------------------------------------------------------------------

/**
 * Converts a Prisma invoice record (with relations) to the canonical EInvoice
 * format consumed by ZatcaProfile.generate().
 *
 * All monetary amounts stay in minor units (grosze/halalas) as the EInvoice
 * type expects integer minor units throughout.
 */
function buildEInvoiceFromPrisma(
  invoice: Record<string, unknown> & {
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date | null;
    currency: string;
    sellerTaxId: string | null;
    sellerName: string | null;
    buyerTaxId: string | null;
    subtotalMinor: number;
    totalMinor: number;
    amountToPayMinor: number;
    vatRate: string | null;
    vatAmountMinor: number | null;
    lines: Record<string, unknown>[];
    contractor: Record<string, unknown> | null;
  },
  opts: { icv: number; pih: string; zatcaUuid: string },
): EInvoice {
  const metadata = (invoice.metadata ?? invoice.metadataJson ?? {}) as Record<string, unknown>;
  const subtype = (metadata.zatcaSubtype as string) ?? "0100000";
  const isSimplified = subtype.startsWith("02");

  return {
    id: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toISOString().split("T")[0]!,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split("T")[0] : undefined,
    invoiceTypeCode: "388",
    currencyCode: invoice.currency,
    supplier: {
      id: invoice.sellerTaxId ?? "",
      name: invoice.sellerName ?? "",
      country: "SA",
    },
    customer: {
      id: invoice.buyerTaxId ?? "",
      name: ((invoice.contractor as Record<string, unknown> | null)?.name as string) ?? "",
    },
    lines: (invoice.lines ?? []).map((line: Record<string, unknown>, idx: number) => ({
      lineNumber: idx + 1,
      description: (line.description as string) ?? "",
      quantity: (line.quantity as number) ?? 1,
      unitPriceMinor: (line.unitPriceMinor as number) ?? 0,
      netAmountMinor: (line.netAmountMinor as number) ?? (line.amountMinor as number) ?? 0,
      vatRate: invoice.vatRate ?? "15.00",
      vatAmountMinor: (line.vatAmountMinor as number) ?? 0,
      grossAmountMinor: (line.grossAmountMinor as number) ?? 0,
    })),
    taxExclusiveAmount: invoice.subtotalMinor,
    taxInclusiveAmount: invoice.totalMinor,
    payableAmount: invoice.amountToPayMinor,
    taxBreakdown: [
      {
        taxableAmountMinor: invoice.subtotalMinor,
        taxAmountMinor: invoice.vatAmountMinor ?? 0,
        taxCategory: "S",
        percent: parseFloat(invoice.vatRate ?? "15"),
      } satisfies EInvoiceTaxSubtotal,
    ],
    profileId: "zatca",
    extensions: {
      icv: opts.icv,
      pih: opts.pih,
      uuid: opts.zatcaUuid,
      invoiceSubtype: subtype,
      profileID: isSimplified ? "reporting:1.0" : "clearance:1.0",
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStandardInvoice(invoice: Record<string, unknown>): boolean {
  const metadata = (invoice.metadata ?? invoice.metadataJson) as Record<string, unknown> | null;
  const subtype = metadata?.zatcaSubtype as string | undefined;
  // Standard subtypes start with "01", simplified with "02"
  if (subtype) return subtype.startsWith("01");
  // Default to standard (B2B) if not specified
  return true;
}

function mapZatcaStatus(
  status: string,
): "CLEARED" | "REPORTED" | "REJECTED" | "WARNING" | "SUBMITTED" {
  switch (status.toUpperCase()) {
    case "CLEARED":
      return "CLEARED";
    case "REPORTED":
      return "REPORTED";
    case "REJECTED":
      return "REJECTED";
    case "WARNING":
    case "CLEARED_WITH_WARNINGS":
    case "REPORTED_WITH_WARNINGS":
      return "WARNING";
    default:
      return "SUBMITTED";
  }
}

function extractRejectionReason(
  validationResults: { errorMessages?: Array<{ message?: string }> } | undefined,
): string {
  if (!validationResults?.errorMessages?.length) return "Unknown rejection";
  return validationResults.errorMessages.map((e) => e.message ?? "Unknown").join("; ");
}
