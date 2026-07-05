// ---------------------------------------------------------------------------
// ZATCA Invoice Submission Service
// ---------------------------------------------------------------------------
// Orchestrates the full ZATCA invoice submission pipeline:
// lock -> chain -> generate -> sign -> hash -> QR -> record -> submit
//
// Async submission via QStash queue.
// Sequential queue per org using advisory lock.
// QStash: 3 retries, exponential backoff, dead letter queue.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@contractor-ops/db';
import { prisma as defaultPrisma } from '@contractor-ops/db';
import type { Prisma } from '@contractor-ops/db/generated/prisma/client';
import type {
  CertificateInfo,
  EInvoice,
  EInvoiceTaxSubtotal,
  ZatcaClearanceResponse,
  ZatcaReportingResponse,
} from '@contractor-ops/einvoice';
import {
  ZATCA_PRODUCTION_URL,
  ZATCA_SANDBOX_URL,
  ZatcaApiClient,
  ZatcaApiError,
  ZatcaProfile,
} from '@contractor-ops/einvoice';
import { createZatcaSecretStore, ZATCA_SECRET_NAMES } from '@contractor-ops/integrations';
import { getQStashClient } from '@contractor-ops/integrations/services/qstash-client';
import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import { isDemoOrg } from '../lib/demo';
import type { PrismaLike } from './zatca-hash-chain';
import { acquireChainLock, getNextChainEntry, recordChainEntry } from './zatca-hash-chain';

const log = createLogger({ service: 'zatca-submission' });

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
  environment: 'test' | 'prod';
}

/** Hash-chain coordinates that pin a single invoice into the org's chain. */
interface ChainCoords {
  icv: number;
  pih: string;
  zatcaUuid: string;
}

/** Signed-XML artifacts produced for one submission attempt. */
interface SubmissionArtifacts {
  invoiceXml: string;
  invoiceHash: string;
  qrBase64: string;
}

/** A persisted (or freshly built) chain row ready to submit to ZATCA. */
interface ChainSubmission extends SubmissionArtifacts {
  id: string;
  zatcaUuid: string;
}

/** Outcome of a `reconcilePendingZatcaChains` sweep. */
export interface ReconcileResult {
  /** PENDING chains found older than the cutoff. */
  scanned: number;
  /** Chains that reached a settled status this run (any non-PENDING outcome). */
  settled: number;
  /** Chains whose resubmission still threw (left PENDING for the next run). */
  failed: number;
}

// ---------------------------------------------------------------------------
// QStash Configuration
// ---------------------------------------------------------------------------

/** QStash retry config: 3 retries, exponential backoff */
const QSTASH_CONFIG = {
  retries: 3,
  /** Backoff intervals: 1s, 4s, 16s (exponential base 4) */
  delay: '1s' as const,
};

// ---------------------------------------------------------------------------
// Main Submission Orchestrator
// ---------------------------------------------------------------------------

/**
 * ZATCA invoice submission pipeline.
 *
 * First submit: advisory-locked transaction builds the next chain entry
 * (ICV + PIH), generates → signs → hashes → QR, records the row PENDING, then
 * submits to ZATCA and settles the status.
 *
 * Retry / reconcile: when a chain row for the invoice already exists it is
 * reused rather than recreated — `ZatcaInvoiceChain.invoiceId` is @unique, so a
 * re-run that recreated it would P2002 before reaching ZATCA. A PENDING row is
 * resubmitted with its original `zatcaUuid` (ZATCA dedups on the uuid); any
 * already-settled row is a no-op.
 */
export async function submitToZatca(
  options: SubmitToZatcaOptions,
  db?: PrismaClient,
): Promise<void> {
  const prisma = db ?? defaultPrisma;
  const { invoiceId, organizationId } = options;

  // Demo read-only — never submit a demo org's invoice to the real ZATCA
  // platform. Reached only via the QStash callback route (a non-tRPC ingress
  // the mutation guard does not cover), so the skip must live here.
  if (isDemoOrg(organizationId)) {
    log.info({ organizationId, invoiceId }, 'demo org — skipping ZATCA submission');
    return;
  }

  // Load invoice and org data
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { contractor: true, lines: true },
  });

  // Get ZATCA connection config
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'ZATCA',
      status: 'CONNECTED',
    },
  });

  if (!connection) {
    throw new Error(`No active ZATCA connection for organization ${organizationId}`);
  }

  const config = connection.configJson as unknown as ZatcaConnectionConfig;
  const environment = config?.environment ?? 'test';

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

  const certInfo: CertificateInfo = { certificate, privateKey };

  // Reuse an existing chain row instead of creating a second one. A QStash
  // retry (or the reconcile cron) that recreated the row would P2002 on the
  // @unique(invoiceId) constraint before ever reaching ZATCA, so the retry
  // could never make progress.
  const existingChain = await prisma.zatcaInvoiceChain.findUnique({
    where: { invoiceId },
    select: { id: true, icv: true, previousHash: true, zatcaUuid: true, zatcaStatus: true },
  });

  let chainRecord: ChainSubmission;

  if (existingChain) {
    // Only a PENDING row is safe to (re)submit. Any settled state
    // (CLEARED/REPORTED/WARNING/REJECTED/SUBMITTED) is terminal — resubmitting
    // would duplicate a ZATCA call or resurrect a rejected invoice.
    if (existingChain.zatcaStatus !== 'PENDING') {
      log.info(
        { organizationId, invoiceId, status: existingChain.zatcaStatus },
        'ZATCA chain already settled — skipping resubmission',
      );
      return;
    }

    // Rebuild the submission from the persisted chain coordinates, reusing the
    // original zatcaUuid so ZATCA treats the resubmit as idempotent. The signed
    // XML is regenerated (it is not persisted) but carries the original
    // icv/pih/uuid, so the hash chain stays anchored on this invoice.
    const artifacts = await buildSubmissionArtifacts(
      invoice,
      {
        icv: existingChain.icv,
        pih: existingChain.previousHash,
        zatcaUuid: existingChain.zatcaUuid,
      },
      certInfo,
      certificate,
    );
    chainRecord = { id: existingChain.id, zatcaUuid: existingChain.zatcaUuid, ...artifacts };
  } else {
    // First submit: advisory-locked transaction allocates the next ICV/PIH,
    // builds + signs the invoice, and records the chain row PENDING.
    chainRecord = await prisma.$transaction(async tx => {
      const txClient = tx as unknown as PrismaLike;
      await acquireChainLock(txClient, organizationId);

      const { icv, pih } = await getNextChainEntry(txClient, organizationId);
      const zatcaUuid = randomUUID();

      const artifacts = await buildSubmissionArtifacts(
        invoice,
        { icv, pih, zatcaUuid },
        certInfo,
        certificate,
      );

      const record = await recordChainEntry(txClient, {
        organizationId,
        icv,
        invoiceId,
        invoiceHash: artifacts.invoiceHash,
        previousHash: pih,
        zatcaUuid,
      });

      return { id: record.id, zatcaUuid, ...artifacts };
    });
  }

  await submitAndSettle({
    prisma,
    invoice: invoice as unknown as Record<string, unknown>,
    organizationId,
    environment,
    certificate,
    apiSecret,
    chainRecord,
  });
}

/**
 * Generate → sign → hash → QR for one invoice against fixed chain coordinates.
 * Free of DB writes so both the first-submit transaction and the idempotent
 * retry path can call it; the retry path passes the persisted coordinates so
 * the resubmission carries the original zatcaUuid.
 */
async function buildSubmissionArtifacts(
  invoice: Parameters<typeof buildEInvoiceFromPrisma>[0],
  coords: ChainCoords,
  certInfo: CertificateInfo,
  certificate: string,
): Promise<SubmissionArtifacts> {
  const eInvoice = buildEInvoiceFromPrisma(invoice, coords);
  const profile = new ZatcaProfile();

  const unsignedXml = await profile.generate(eInvoice);
  const signedXml = await profile.sign.sign(unsignedXml, certInfo);
  const invoiceHash = createHash('sha256').update(signedXml).digest('hex');

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

  return { invoiceXml: signedXml, invoiceHash, qrBase64: qrBuffer.toString('base64') };
}

/**
 * Submit the built invoice to ZATCA (clearance for standard, reporting for
 * simplified) and settle the chain row.
 *
 * Error classification decides the row's fate:
 *   - A validation/4xx rejection (`ZatcaApiError` `non-retryable`) is permanent
 *     → mark REJECTED.
 *   - Anything else — network error, timeout, 5xx/429 (`retryable`), or an auth
 *     failure — is transient → leave the row PENDING (`submittedAt` unset) so a
 *     QStash retry or the reconcile cron can resettle it. A transport failure
 *     does NOT mean ZATCA rejected the invoice; it may have cleared, so we must
 *     never brand it REJECTED here.
 */
async function submitAndSettle(args: {
  prisma: PrismaClient;
  invoice: Record<string, unknown>;
  organizationId: string;
  environment: 'test' | 'prod';
  certificate: string;
  apiSecret: string;
  chainRecord: ChainSubmission;
}): Promise<void> {
  const { prisma, invoice, organizationId, environment, certificate, apiSecret, chainRecord } =
    args;

  const apiClient = new ZatcaApiClient({
    baseUrl: environment === 'prod' ? ZATCA_PRODUCTION_URL : ZATCA_SANDBOX_URL,
    binarySecurityToken: certificate,
    secret: apiSecret,
  });

  const payload = {
    invoiceHash: chainRecord.invoiceHash,
    uuid: chainRecord.zatcaUuid,
    invoice: Buffer.from(chainRecord.invoiceXml).toString('base64'),
  };

  try {
    // Standard invoices (subtype "01") clear; simplified ("02") report.
    const isStandard = isStandardInvoice(invoice);

    let response: ZatcaClearanceResponse | ZatcaReportingResponse;
    let status: string;

    if (isStandard) {
      response = await apiClient.submitForClearance(payload, organizationId);
      status = (response as ZatcaClearanceResponse).clearanceStatus;
    } else {
      response = await apiClient.submitForReporting(payload, organizationId);
      status = (response as ZatcaReportingResponse).reportingStatus;
    }

    const now = new Date();
    await prisma.zatcaInvoiceChain.update({
      where: { id: chainRecord.id },
      data: {
        zatcaStatus: mapZatcaStatus(status),
        zatcaResponse: response as unknown as Prisma.InputJsonValue,
        submittedAt: now,
        ...(status === 'CLEARED' && { clearedAt: now }),
        ...(status === 'REPORTED' && { reportedAt: now }),
        ...(status === 'REJECTED' && {
          rejectedAt: now,
          rejectionReason: extractRejectionReason(response.validationResults),
        }),
      },
    });
  } catch (error) {
    if (error instanceof ZatcaApiError && error.errorType === 'non-retryable') {
      const now = new Date();
      await prisma.zatcaInvoiceChain.update({
        where: { id: chainRecord.id },
        data: {
          zatcaStatus: 'REJECTED',
          submittedAt: now,
          rejectedAt: now,
          rejectionReason: `API Error ${error.statusCode}: ${error.errorType}`,
        },
      });
    } else {
      log.warn(
        {
          err: error,
          organizationId,
          chainId: chainRecord.id,
          errorType: error instanceof ZatcaApiError ? error.errorType : 'network',
        },
        'ZATCA submission transient failure — chain stays PENDING for retry',
      );
    }

    // Rethrow so the QStash handler decides retry vs dead-letter.
    throw error;
  }
}

/**
 * Requery ZATCA for chains stuck PENDING past `olderThanMinutes` and settle
 * them. Backstop for a transient failure that outlived its QStash retries: each
 * resubmission reuses the row's original zatcaUuid, so ZATCA treats it
 * idempotently and a since-cleared invoice simply settles.
 */
export async function reconcilePendingZatcaChains(
  opts: { olderThanMinutes: number; limit?: number },
  db?: PrismaClient,
): Promise<ReconcileResult> {
  const prisma = db ?? defaultPrisma;
  const cutoff = new Date(Date.now() - opts.olderThanMinutes * 60_000);

  const stale = await prisma.zatcaInvoiceChain.findMany({
    where: { zatcaStatus: 'PENDING', createdAt: { lt: cutoff } },
    select: { invoiceId: true, organizationId: true },
    orderBy: { createdAt: 'asc' },
    take: opts.limit ?? 100,
  });

  let settled = 0;
  let failed = 0;

  for (const row of stale) {
    try {
      await submitToZatca({ invoiceId: row.invoiceId, organizationId: row.organizationId }, prisma);
      settled += 1;
    } catch (error) {
      failed += 1;
      log.warn(
        { err: error, invoiceId: row.invoiceId, organizationId: row.organizationId },
        'ZATCA reconcile: chain still failing, will retry next run',
      );
    }
  }

  return { scanned: stale.length, settled, failed };
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
      if (error.errorType === 'non-retryable' || error.errorType === 'auth') {
        // Don't retry -- log and let QStash mark as dead
        log.error(
          {
            err: error,
            invoiceId: payload.invoiceId,
            statusCode: error.statusCode,
            errorType: error.errorType,
          },
          'non-retryable error for invoice',
        );
        return; // Returning 200 tells QStash to not retry
      }
      // Retryable error -- throw to trigger QStash retry
      log.warn(
        { invoiceId: payload.invoiceId, statusCode: error.statusCode },
        'retryable error for invoice',
      );
    }
    throw error;
  }
}

/**
 * Queue a ZATCA submission job via QStash with retry config.
 */
export async function queueZatcaSubmission(
  invoiceId: string,
  organizationId: string,
): Promise<void> {
  const qstash = getQStashClient();
  const apiUrl = getServerEnv().API_URL;

  await qstash.publishJSON({
    url: `${apiUrl}/zatca/_submit`,
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
  const subtype = (metadata.zatcaSubtype as string) ?? '0100000';
  const isSimplified = subtype.startsWith('02');

  return {
    id: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toISOString().split('T')[0] ?? '',
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : undefined,
    invoiceTypeCode: '388',
    currencyCode: invoice.currency,
    supplier: {
      id: invoice.sellerTaxId ?? '',
      name: invoice.sellerName ?? '',
      country: 'SA',
    },
    customer: {
      id: invoice.buyerTaxId ?? '',
      name: ((invoice.contractor as Record<string, unknown> | null)?.displayName as string) ?? '',
    },
    lines: (invoice.lines ?? []).map((line: Record<string, unknown>, idx: number) => ({
      lineNumber: idx + 1,
      description: (line.description as string) ?? '',
      quantity: (line.quantity as number) ?? 1,
      unitPriceMinor: (line.unitPriceMinor as number) ?? 0,
      netAmountMinor: (line.netAmountMinor as number) ?? (line.amountMinor as number) ?? 0,
      vatRate: invoice.vatRate ?? '15.00',
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
        taxCategory: 'S',
        percent: parseFloat(invoice.vatRate ?? '15'),
      } satisfies EInvoiceTaxSubtotal,
    ],
    profileId: 'zatca',
    extensions: {
      icv: opts.icv,
      pih: opts.pih,
      uuid: opts.zatcaUuid,
      invoiceSubtype: subtype,
      profileID: isSimplified ? 'reporting:1.0' : 'clearance:1.0',
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
  if (subtype) return subtype.startsWith('01');
  // Default to standard (B2B) if not specified
  return true;
}

function mapZatcaStatus(
  status: string,
): 'CLEARED' | 'REPORTED' | 'REJECTED' | 'WARNING' | 'SUBMITTED' {
  switch (status.toUpperCase()) {
    case 'CLEARED':
      return 'CLEARED';
    case 'REPORTED':
      return 'REPORTED';
    case 'REJECTED':
      return 'REJECTED';
    case 'WARNING':
    case 'CLEARED_WITH_WARNINGS':
    case 'REPORTED_WITH_WARNINGS':
      return 'WARNING';
    default:
      return 'SUBMITTED';
  }
}

function extractRejectionReason(
  validationResults: { errorMessages?: Array<{ message?: string }> } | undefined,
): string {
  if (!validationResults?.errorMessages?.length) return 'Unknown rejection';
  return validationResults.errorMessages.map(e => e.message ?? 'Unknown').join('; ');
}
