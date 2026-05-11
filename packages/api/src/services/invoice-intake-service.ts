// packages/api/src/services/invoice-intake-service.ts
//
// Phase 62 · Plan 62-04 Task 2 — state-machine orchestration for the inbound
// e-invoice intake pipeline (EINV-03, D-09, D-12).
//
// Five pure-service entrypoints consumed by the tRPC router (Plan 62-05):
//
//   uploadAndPersist       — parse + validate + R2 + INSERT (idempotent by
//                            (orgId, rawFileSha256))
//   confirmMatch           — link an intake row to a contractor + contract
//   acknowledgeValidation  — capture a human sign-off on WARNINGS / INVALID
//   convertToInvoice       — promote a matched intake into a real Invoice
//   reject                 — close an intake with a reason
//
// All mutations that touch more than one row run inside `db.$transaction`.
// Every query filters by `organizationId`; cross-tenant access resolves to
// `INVALID_STATE_TRANSITION` / `NOT_FOUND` — never `FORBIDDEN` — to avoid
// the response-code oracle pattern documented elsewhere in the project.
//
// Logging uses the Pino root logger via `.child({ module })`. Raw file bytes,
// parsed invoice JSON, and extracted supplier PII are NEVER logged.
//
// Threats mitigated:
//   T-62-04-S1 (stored XSS via PDF attachment): size gate + MIME gate + UTF-8
//       BOM strip; parser only runs on the extracted bytes, KoSIT validator
//       owns schema enforcement.
//   T-62-04-S2 (cross-tenant intake read): every mutation asserts
//       intake.organizationId === orgId before proceeding.
//   T-62-04-S3 (duplicate uploads): content-addressed dedup via
//       (orgId, rawFileSha256) unique constraint, with race-safe re-fetch
//       on P2002.
//   T-62-04-S4 (replay-after-conversion): convertToInvoice is idempotent;
//       reject is blocked once status === CONVERTED.
//   T-62-04-S5 (acknowledge-before-warning): acknowledgeValidation refuses
//       to run on rows whose validationStatus is still VALID.

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@contractor-ops/db';
import type {
  InvoiceIntakeProfileLevel,
  InvoiceIntakeStatus,
  InvoiceIntakeValidationStatus,
} from '@contractor-ops/db/generated/prisma/client';
import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import type {
  ParsedXrechnung,
  ParsedZugferd,
  XRechnungValidationReport,
  ZugferdConformanceLevel,
} from '@contractor-ops/einvoice';
import {
  parseXrechnungCii,
  parseZugferdPdf,
  validateZugferdEmbeddedXml,
} from '@contractor-ops/einvoice';
import { createLogger } from '@contractor-ops/logger';

import { putObjectAndSignDownload, putObjectString } from './r2';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type UploadFileKind = 'xml' | 'pdf';

export interface UploadInput {
  orgId: string;
  userId: string;
  fileKind: UploadFileKind;
  /** Base64-encoded file contents. Server decodes before size / MIME gating. */
  fileBase64: string;
  mime: string;
  originalFilename: string;
}

export type UploadResult =
  | {
      kind: 'CREATED';
      intakeId: string;
      profileLevel: ZugferdConformanceLevel;
      validationStatus: InvoiceIntakeValidationStatus;
      warnings: string[];
    }
  | { kind: 'DEDUP_RETURNED'; intakeId: string };

export type IntakeServiceErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_MIME'
  | 'CII_XSD_INVALID'
  | 'INVALID_STATE_TRANSITION'
  | 'NOT_FOUND'
  | 'VALIDATION_NOT_REQUIRED'
  | 'REASON_TOO_SHORT'
  | 'DUPLICATE_INVOICE_NUMBER';

export interface IntakeServiceError {
  code: IntakeServiceErrorCode;
  message: string;
  /** Populated when the error carries extra diagnostic context. */
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Injected dependency surface (allows unit tests to swap parser / validator
// / R2 without mocking the modules themselves).
// ---------------------------------------------------------------------------

export interface IntakeServiceDeps {
  parseZugferdPdf?: (bytes: Uint8Array) => Promise<ParsedZugferd>;
  parseXrechnungCii?: (xml: string) => ParsedXrechnung;
  validateEmbeddedXml?: (xml: string) => Promise<XRechnungValidationReport>;
  r2?: {
    putObjectString: (p: { key: string; body: string; contentType: string }) => Promise<void>;
    putObjectAndSignDownload: (p: {
      key: string;
      body: Uint8Array | Buffer;
      contentType: string;
    }) => Promise<{ signedUrl: string; expiresInSeconds: number }>;
  };
  /** Deterministic clock for unit tests; defaults to `new Date()`. */
  now?: () => Date;
}

const log = createLogger({ module: 'invoice-intake-service' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Hard upload ceiling — mirrors the XRechnung finalize limit and keeps the
 * service well under any reasonable R2 object size for a real invoice.
 */
export const INTAKE_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_XML_MIMES = new Set(['application/xml', 'text/xml']);
export const ALLOWED_PDF_MIMES = new Set(['application/pdf']);

const R2_CONTENT_TYPES = {
  pdf: 'application/pdf',
  xml: 'application/xml',
  html: 'text/html; charset=utf-8',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(
  code: IntakeServiceErrorCode,
  message: string,
  details?: unknown,
): IntakeServiceError {
  return details === undefined ? { code, message } : { code, message, details };
}

function mapConformanceToProfileLevel(level: ZugferdConformanceLevel): InvoiceIntakeProfileLevel {
  // The DB enum exposes COMFORT / XRECHNUNG / EXTENDED; the parser may
  // return the same three, so this map is almost identity but keeps the
  // Prisma-typed column shielded from einvoice package enum drift.
  switch (level) {
    case 'COMFORT':
      return 'COMFORT';
    case 'XRECHNUNG':
      return 'XRECHNUNG';
    case 'EXTENDED':
      return 'EXTENDED';
    default: {
      // Exhaustive guard — if the einvoice package adds a new level, this
      // throws at runtime rather than silently writing a bogus value.
      const never: never = level;
      throw new Error(`Unsupported ZUGFeRD conformance level: ${String(never)}`);
    }
  }
}

function deriveIntakeStatus(
  validationStatus: InvoiceIntakeValidationStatus,
  profileLevel: ZugferdConformanceLevel,
): InvoiceIntakeStatus {
  if (validationStatus === 'VALID' && profileLevel !== 'EXTENDED') {
    return 'PARSED';
  }
  // WARNINGS / INVALID / EXTENDED-best-effort → human review required
  return 'NEEDS_REVIEW';
}

/** Extract up to first N XSD failure messages for the error payload. */
function firstXsdErrors(report: XRechnungValidationReport, n: number): string[] {
  const xsd = report.layers.find(l => l.layer === 'XSD');
  if (!xsd) return [];
  return xsd.errors.slice(0, n).map(e => `${e.ruleId}: ${e.message}`);
}

function isXsdFailure(report: XRechnungValidationReport): boolean {
  const xsd = report.layers.find(l => l.layer === 'XSD');
  if (!xsd) return false;
  return xsd.status === 'FAIL' || xsd.errors.length > 0;
}

function flattenWarnings(report: XRechnungValidationReport): string[] {
  const out: string[] = [];
  for (const layer of report.layers) {
    for (const w of layer.warnings) {
      out.push(`${layer.layer}:${w.ruleId}: ${w.message}`);
    }
  }
  return out;
}

function deriveValidationStatus(report: XRechnungValidationReport): InvoiceIntakeValidationStatus {
  switch (report.status) {
    case 'VALID':
      return 'VALID';
    case 'WARNINGS':
      return 'WARNINGS';
    case 'INVALID':
      return 'INVALID';
    default:
      return 'INVALID';
  }
}

// ---------------------------------------------------------------------------
// uploadAndPersist
// ---------------------------------------------------------------------------

/**
 * Upload a fresh XRechnung / ZUGFeRD file: validate size + MIME, compute the
 * content hash, check dedup, parse + validate, push bytes + XML + report to
 * R2, persist the intake row. Throws typed errors on gate failures; returns
 * `DEDUP_RETURNED` on repeat uploads.
 */
export async function uploadAndPersist(
  db: PrismaClient,
  input: UploadInput,
  deps: IntakeServiceDeps = {},
): Promise<UploadResult> {
  const parsePdf = deps.parseZugferdPdf ?? parseZugferdPdf;
  const parseXml = deps.parseXrechnungCii ?? parseXrechnungCii;
  const validate = deps.validateEmbeddedXml ?? validateZugferdEmbeddedXml;
  const r2 = deps.r2 ?? { putObjectString, putObjectAndSignDownload };

  // ── 1. Size gate (compute bytes once and reuse) ──────────────────────────
  const bytes = Buffer.from(input.fileBase64, 'base64');
  if (bytes.length > INTAKE_MAX_FILE_BYTES) {
    throw makeError(
      'FILE_TOO_LARGE',
      `Upload exceeds ${INTAKE_MAX_FILE_BYTES} bytes (got ${bytes.length})`,
    );
  }

  // ── 2. MIME gate ─────────────────────────────────────────────────────────
  const mimeOk =
    input.fileKind === 'pdf'
      ? ALLOWED_PDF_MIMES.has(input.mime)
      : ALLOWED_XML_MIMES.has(input.mime);
  if (!mimeOk) {
    throw makeError(
      'UNSUPPORTED_MIME',
      `Unsupported MIME type "${input.mime}" for fileKind="${input.fileKind}"`,
    );
  }

  // ── 3. SHA-256 content hash (dedup key) ──────────────────────────────────
  const rawSha = createHash('sha256').update(bytes).digest('hex');

  // ── 4. Dedup pre-check ───────────────────────────────────────────────────
  const existing = await db.invoiceIntakeRequest.findUnique({
    where: {
      organizationId_rawFileSha256: {
        organizationId: input.orgId,
        rawFileSha256: rawSha,
      },
    },
    select: { id: true },
  });
  if (existing) {
    log.info({ orgId: input.orgId, intakeId: existing.id }, 'intake dedup hit');
    return { kind: 'DEDUP_RETURNED', intakeId: existing.id };
  }

  // ── 5. Parse ─────────────────────────────────────────────────────────────
  let parsed: ParsedZugferd | ParsedXrechnung;
  let extractedXml: string;
  if (input.fileKind === 'pdf') {
    const pdfParsed = await parsePdf(new Uint8Array(bytes));
    parsed = pdfParsed;
    extractedXml = pdfParsed.extractedXml;
  } else {
    // Strip UTF-8 BOM if the buffer starts with EF BB BF before decoding.
    let text = bytes.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    parsed = parseXml(text);
    extractedXml = text;
  }

  // ── 6. KoSIT validation (3-layer) ────────────────────────────────────────
  const report = await validate(extractedXml);
  if (isXsdFailure(report)) {
    throw makeError('CII_XSD_INVALID', 'Embedded XML failed XSD (layer-1) validation', {
      errors: firstXsdErrors(report, 5),
    });
  }

  const validationStatus = deriveValidationStatus(report);
  const profileLevel = parsed.profileLevel;

  // ── 7. R2 uploads (raw → extracted → report) ─────────────────────────────
  const shaPrefix = rawSha.slice(0, 16);
  const keyBase = `einvoice-intake/${input.orgId}`;
  const rawKey = `${keyBase}/${shaPrefix}.${input.fileKind === 'pdf' ? 'pdf' : 'xml'}`;
  const extractedKey = input.fileKind === 'pdf' ? `${keyBase}/${shaPrefix}-extracted.xml` : rawKey;
  const reportKey = `${keyBase}/${shaPrefix}-${report.ruleSetVersion}-report.html`;

  await r2.putObjectAndSignDownload({
    key: rawKey,
    body: bytes,
    contentType: input.fileKind === 'pdf' ? R2_CONTENT_TYPES.pdf : R2_CONTENT_TYPES.xml,
  });
  if (input.fileKind === 'pdf') {
    await r2.putObjectString({
      key: extractedKey,
      body: extractedXml,
      contentType: R2_CONTENT_TYPES.xml,
    });
  }
  await r2.putObjectString({
    key: reportKey,
    body: JSON.stringify(report, null, 2),
    contentType: R2_CONTENT_TYPES.html,
  });

  // ── 8. Persist intake row (race-safe on P2002) ───────────────────────────
  const intakeStatus = deriveIntakeStatus(validationStatus, profileLevel);
  const warnings = flattenWarnings(report);
  if (profileLevel === 'EXTENDED') {
    warnings.push('LEVEL_EXTENDED_BEST_EFFORT');
  }

  const invoice = parsed.invoice;
  const sourceKind = input.fileKind === 'pdf' ? 'UPLOAD_PDF' : 'UPLOAD_XML';
  const supplierVatId = invoice.supplier?.id || null;
  const invoiceNumber = invoice.id || null;
  const invoiceDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
  const totalMinor =
    typeof invoice.taxInclusiveAmount === 'number' ? BigInt(invoice.taxInclusiveAmount) : null;
  const currency = invoice.currencyCode || null;

  try {
    const created = await db.invoiceIntakeRequest.create({
      data: {
        organizationId: input.orgId,
        uploadedByUserId: input.userId,
        sourceKind,
        rawFileKey: rawKey,
        rawFileSha256: rawSha,
        rawFileMime: input.mime,
        rawFileSizeBytes: bytes.length,
        extractedXmlKey: extractedKey,
        validationReportKey: reportKey,
        profileLevel: mapConformanceToProfileLevel(profileLevel),
        parsedInvoiceJson: invoice as unknown as Prisma.InputJsonValue,
        extractedSupplierName: invoice.supplier?.name ?? null,
        extractedSupplierVatId: supplierVatId,
        // supplierLeitwegId is not on the canonical EInvoice envelope today;
        // leave null and let the matcher derive it from contractor.leitwegIds.
        extractedSupplierLeitwegId: null,
        extractedInvoiceNumber: invoiceNumber,
        extractedInvoiceDate: invoiceDate,
        extractedTotalMinor: totalMinor,
        extractedCurrency: currency,
        status: intakeStatus,
        validationStatus,
        unmappedFieldsJson:
          'unmappedFields' in parsed && parsed.unmappedFields.length > 0
            ? ({ unmappedFields: parsed.unmappedFields, warnings } as Prisma.InputJsonValue)
            : warnings.length > 0
              ? ({ warnings } as Prisma.InputJsonValue)
              : Prisma.JsonNull,
      },
      select: { id: true },
    });

    return {
      kind: 'CREATED',
      intakeId: created.id,
      profileLevel,
      validationStatus,
      warnings,
    };
  } catch (err) {
    // Race: another upload of the same bytes landed between our findUnique
    // and our create. Re-fetch the existing row and return DEDUP_RETURNED.
    if (isUniqueConstraintViolation(err)) {
      const raced = await db.invoiceIntakeRequest.findUnique({
        where: {
          organizationId_rawFileSha256: {
            organizationId: input.orgId,
            rawFileSha256: rawSha,
          },
        },
        select: { id: true },
      });
      if (raced) {
        log.info({ orgId: input.orgId, intakeId: raced.id }, 'intake dedup hit (race)');
        return { kind: 'DEDUP_RETURNED', intakeId: raced.id };
      }
    }
    throw err;
  }
}

function isUniqueConstraintViolation(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return code === 'P2002';
}

// ---------------------------------------------------------------------------
// confirmMatch
// ---------------------------------------------------------------------------

export interface ConfirmMatchInput {
  orgId: string;
  intakeId: string;
  contractorId: string;
  contractId?: string | undefined;
}

/**
 * Attach a confirmed Contractor / Contract pairing to an intake row and
 * advance its status to MATCHED. Only intakes in PARSED or NEEDS_REVIEW may
 * be matched; re-matching a row that is already MATCHED is a precondition
 * error (callers should reject first).
 */
export async function confirmMatch(db: PrismaClient, input: ConfirmMatchInput): Promise<void> {
  const intake = await db.invoiceIntakeRequest.findUnique({
    where: { id: input.intakeId },
    select: {
      id: true,
      organizationId: true,
      status: true,
    },
  });
  if (!intake || intake.organizationId !== input.orgId) {
    throw makeError('NOT_FOUND', `Intake ${input.intakeId} not found`);
  }
  if (intake.status !== 'PARSED' && intake.status !== 'NEEDS_REVIEW') {
    throw makeError(
      'INVALID_STATE_TRANSITION',
      `Cannot confirm match on intake in status ${intake.status}`,
    );
  }

  // Cross-tenant FK guard (defense-in-depth): Prisma's tenant extension
  // scopes top-level where/data, but relation-level `include` loads are
  // not re-scoped. Pre-check both FK targets live in the caller's org so
  // a forged contractorId/contractId cannot cross tenant boundaries via
  // later nested reads.
  const contractor = await db.contractor.findFirst({
    where: { id: input.contractorId, organizationId: input.orgId },
    select: { id: true },
  });
  if (!contractor) {
    throw makeError('NOT_FOUND', `Contractor ${input.contractorId} not found`);
  }

  if (input.contractId) {
    const contract = await db.contract.findFirst({
      where: {
        id: input.contractId,
        organizationId: input.orgId,
        contractorId: input.contractorId,
      },
      select: { id: true },
    });
    if (!contract) {
      throw makeError('NOT_FOUND', `Contract ${input.contractId} not found`);
    }
  }

  await db.invoiceIntakeRequest.update({
    where: { id: input.intakeId },
    data: {
      matchedContractorId: input.contractorId,
      matchedContractId: input.contractId ?? null,
      status: 'MATCHED',
    },
  });
}

// ---------------------------------------------------------------------------
// acknowledgeValidation
// ---------------------------------------------------------------------------

export interface AcknowledgeValidationInput {
  orgId: string;
  intakeId: string;
  userId: string;
}

/**
 * Capture a human acknowledgement of the KoSIT validation report. Only valid
 * on intakes whose validationStatus is WARNINGS or INVALID — acknowledging
 * a VALID row is a precondition violation (nothing to sign off).
 */
export async function acknowledgeValidation(
  db: PrismaClient,
  input: AcknowledgeValidationInput,
  deps: IntakeServiceDeps = {},
): Promise<void> {
  const now = deps.now ?? (() => new Date());
  const intake = await db.invoiceIntakeRequest.findUnique({
    where: { id: input.intakeId },
    select: {
      id: true,
      organizationId: true,
      validationStatus: true,
    },
  });
  if (!intake || intake.organizationId !== input.orgId) {
    throw makeError('NOT_FOUND', `Intake ${input.intakeId} not found`);
  }
  if (intake.validationStatus !== 'WARNINGS' && intake.validationStatus !== 'INVALID') {
    throw makeError(
      'VALIDATION_NOT_REQUIRED',
      `Intake ${input.intakeId} validationStatus=${intake.validationStatus} requires no acknowledgement`,
    );
  }

  await db.invoiceIntakeRequest.update({
    where: { id: input.intakeId },
    data: {
      validationAcknowledgedAt: now(),
      validationAcknowledgedByUserId: input.userId,
    },
  });
}

// ---------------------------------------------------------------------------
// convertToInvoice
// ---------------------------------------------------------------------------

export interface ConvertToInvoiceInput {
  orgId: string;
  intakeId: string;
  userId: string;
}

export interface ConvertToInvoiceResult {
  invoiceId: string;
}

/**
 * Promote a MATCHED intake into a real `Invoice` row (+ lines). Idempotent:
 * a second call on a CONVERTED intake returns the same invoiceId. Requires
 * either validationStatus=VALID or a prior acknowledgement.
 */
export async function convertToInvoice(
  db: PrismaClient,
  input: ConvertToInvoiceInput,
  deps: IntakeServiceDeps = {},
): Promise<ConvertToInvoiceResult> {
  const now = deps.now ?? (() => new Date());

  const intake = await db.invoiceIntakeRequest.findUnique({
    where: { id: input.intakeId },
  });
  if (!intake || intake.organizationId !== input.orgId) {
    throw makeError('NOT_FOUND', `Intake ${input.intakeId} not found`);
  }

  // Idempotency: already converted → return the same invoiceId.
  if (intake.status === 'CONVERTED' && intake.convertedInvoiceId) {
    return { invoiceId: intake.convertedInvoiceId };
  }

  if (intake.status !== 'MATCHED') {
    throw makeError(
      'INVALID_STATE_TRANSITION',
      `Cannot convert intake in status ${intake.status}; MATCHED required`,
    );
  }

  const needsAck = intake.validationStatus !== 'VALID';
  if (needsAck && !intake.validationAcknowledgedAt) {
    throw makeError(
      'INVALID_STATE_TRANSITION',
      `Intake ${input.intakeId} requires validation acknowledgement before conversion`,
    );
  }

  if (!intake.matchedContractorId) {
    throw makeError(
      'INVALID_STATE_TRANSITION',
      `Intake ${input.intakeId} has no matched contractor`,
    );
  }

  // ── Build the Invoice payload from parsedInvoiceJson ───────────────────
  const parsed = intake.parsedInvoiceJson as unknown as {
    id?: string;
    issueDate?: string;
    dueDate?: string;
    currencyCode?: string;
    taxExclusiveAmount?: number;
    taxInclusiveAmount?: number;
    payableAmount?: number;
    supplier?: { id?: string; name?: string };
    customer?: { id?: string };
    lines?: Array<{
      lineNumber: number;
      description: string;
      quantity?: number;
      unit?: string;
      unitPriceMinor?: number;
      netAmountMinor?: number;
      vatRate?: string;
      vatAmountMinor?: number;
      grossAmountMinor?: number;
    }>;
    taxBreakdown?: Array<{ taxAmountMinor?: number }>;
  };

  const issueDate = parsed.issueDate ? new Date(parsed.issueDate) : now();
  const dueDate = parsed.dueDate ? new Date(parsed.dueDate) : issueDate;
  const currency = (parsed.currencyCode ?? 'EUR').toUpperCase();
  const subtotalMinor = parsed.taxExclusiveAmount ?? 0;
  const totalMinor = parsed.taxInclusiveAmount ?? subtotalMinor;
  const amountToPayMinor = parsed.payableAmount ?? totalMinor;
  const vatAmountMinor =
    parsed.taxBreakdown && parsed.taxBreakdown.length > 0
      ? parsed.taxBreakdown.reduce((acc, row) => acc + (row.taxAmountMinor ?? 0), 0)
      : totalMinor - subtotalMinor;

  const invoiceNumber = parsed.id || intake.extractedInvoiceNumber || `INTAKE-${intake.id}`;
  const sellerTaxId = parsed.supplier?.id ?? intake.extractedSupplierVatId ?? null;
  const sellerName = parsed.supplier?.name ?? intake.extractedSupplierName ?? null;
  const buyerTaxId = parsed.customer?.id ?? null;
  const duplicateCheckHash = intake.rawFileSha256;

  const linesData = (parsed.lines ?? []).map((line, idx) => ({
    organizationId: input.orgId,
    lineNumber: line.lineNumber ?? idx + 1,
    description: line.description ?? '',
    quantity: line.quantity == null ? null : line.quantity,
    unit: line.unit ?? null,
    unitPriceMinor: line.unitPriceMinor ?? null,
    netAmountMinor: line.netAmountMinor ?? null,
    vatRate: line.vatRate ?? null,
    vatAmountMinor: line.vatAmountMinor ?? null,
    grossAmountMinor: line.grossAmountMinor ?? null,
  }));

  return db.$transaction(async tx => {
    let invoice: { id: string };
    try {
      invoice = await tx.invoice.create({
        data: {
          organizationId: input.orgId,
          contractorId: intake.matchedContractorId,
          contractId: intake.matchedContractId,
          invoiceNumber,
          source: 'PEPPOL',
          sourceReference: `intake:${intake.id}`,
          issueDate,
          dueDate,
          currency,
          subtotalMinor,
          vatAmountMinor: Number.isFinite(vatAmountMinor) ? vatAmountMinor : null,
          totalMinor,
          amountToPayMinor,
          sellerTaxId,
          sellerName,
          buyerTaxId,
          duplicateCheckHash,
          lines: {
            create: linesData.map(({ organizationId: _omit, ...rest }) => ({
              organizationId: input.orgId,
              ...rest,
            })),
          },
        },
        select: { id: true },
      });
    } catch (err) {
      // Finding #5: GoBD requires that two intakes carrying the same
      // supplier-issued invoice number cannot both produce real Invoice
      // rows. The (organizationId, contractorId, invoiceNumber) unique
      // index is the authoritative guard; surface it as a typed error
      // so the router can map to CONFLICT rather than 500.
      if (isUniqueConstraintViolation(err)) {
        throw makeError(
          'DUPLICATE_INVOICE_NUMBER',
          `Invoice ${invoiceNumber} already exists for this contractor`,
          { invoiceNumber },
        );
      }
      throw err;
    }

    await tx.invoiceIntakeRequest.update({
      where: { id: intake.id },
      data: {
        status: 'CONVERTED',
        convertedInvoiceId: invoice.id,
      },
    });

    return { invoiceId: invoice.id };
  });
}

// ---------------------------------------------------------------------------
// reject
// ---------------------------------------------------------------------------

export interface RejectInput {
  orgId: string;
  intakeId: string;
  userId: string;
  reason: string;
}

/**
 * Close an intake with a human-supplied reason. Blocked on already-CONVERTED
 * rows — those must be cancelled at the Invoice layer, not the intake layer.
 */
export async function reject(db: PrismaClient, input: RejectInput): Promise<void> {
  if (input.reason.trim().length < 3) {
    throw makeError('REASON_TOO_SHORT', `Rejection reason must be at least 3 characters`);
  }

  const intake = await db.invoiceIntakeRequest.findUnique({
    where: { id: input.intakeId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!intake || intake.organizationId !== input.orgId) {
    throw makeError('NOT_FOUND', `Intake ${input.intakeId} not found`);
  }
  if (intake.status === 'CONVERTED') {
    throw makeError('INVALID_STATE_TRANSITION', `Cannot reject intake in status ${intake.status}`);
  }

  await db.invoiceIntakeRequest.update({
    where: { id: input.intakeId },
    data: {
      status: 'REJECTED',
      rejectionReason: input.reason,
    },
  });
}
