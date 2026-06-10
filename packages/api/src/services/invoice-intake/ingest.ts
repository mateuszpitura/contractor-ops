import { createHash } from 'node:crypto';

import type { PrismaClient } from '@contractor-ops/db';
import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import {
  parseXrechnungCii,
  parseZugferdPdf,
  validateZugferdEmbeddedXml,
} from '@contractor-ops/einvoice';
import { createLogger } from '@contractor-ops/logger';

import { putObjectAndSignDownload, putObjectString } from '../r2.js';
import {
  deriveIntakeStatus,
  deriveValidationStatus,
  firstXsdErrors,
  flattenWarnings,
  isUniqueConstraintViolation,
  isXsdFailure,
  makeError,
  mapConformanceToProfileLevel,
} from './shared.js';
import {
  ALLOWED_PDF_MIMES,
  ALLOWED_XML_MIMES,
  INTAKE_MAX_FILE_BYTES,
  R2_CONTENT_TYPES,
  type IntakeServiceDeps,
  type UploadInput,
  type UploadResult,
} from './types.js';

const log = createLogger({ module: 'invoice-intake-service' });

export async function uploadAndPersist(
  db: PrismaClient,
  input: UploadInput,
  deps: IntakeServiceDeps = {},
): Promise<UploadResult> {
  const parsePdf = deps.parseZugferdPdf ?? parseZugferdPdf;
  const parseXml = deps.parseXrechnungCii ?? parseXrechnungCii;
  const validate = deps.validateEmbeddedXml ?? validateZugferdEmbeddedXml;
  const r2 = deps.r2 ?? { putObjectString, putObjectAndSignDownload };

  const bytes = Buffer.from(input.fileBase64, 'base64');
  if (bytes.length > INTAKE_MAX_FILE_BYTES) {
    throw makeError(
      'FILE_TOO_LARGE',
      `Upload exceeds ${INTAKE_MAX_FILE_BYTES} bytes (got ${bytes.length})`,
    );
  }

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

  const rawSha = createHash('sha256').update(bytes).digest('hex');

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

  let parsed: Awaited<ReturnType<typeof parsePdf>> | ReturnType<typeof parseXml>;
  let extractedXml: string;
  if (input.fileKind === 'pdf') {
    const pdfParsed = await parsePdf(new Uint8Array(bytes));
    parsed = pdfParsed;
    extractedXml = pdfParsed.extractedXml;
  } else {
    let text = bytes.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    parsed = parseXml(text);
    extractedXml = text;
  }

  const report = await validate(extractedXml);
  if (isXsdFailure(report)) {
    throw makeError('CII_XSD_INVALID', 'Embedded XML failed XSD (layer-1) validation', {
      errors: firstXsdErrors(report, 5),
    });
  }

  const validationStatus = deriveValidationStatus(report);
  const profileLevel = parsed.profileLevel;

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
