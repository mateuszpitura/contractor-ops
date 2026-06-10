import type {
  ParsedXrechnung,
  ParsedZugferd,
  XRechnungValidationReport,
  ZugferdConformanceLevel,
} from '@contractor-ops/einvoice';
import type { InvoiceIntakeValidationStatus } from '@contractor-ops/db/generated/prisma/client';

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
  details?: unknown;
}

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
  now?: () => Date;
}

export interface ConfirmMatchInput {
  orgId: string;
  intakeId: string;
  contractorId: string;
  contractId?: string | undefined;
}

export interface AcknowledgeValidationInput {
  orgId: string;
  intakeId: string;
  userId: string;
}

export interface ConvertToInvoiceInput {
  orgId: string;
  intakeId: string;
  userId: string;
}

export interface ConvertToInvoiceResult {
  invoiceId: string;
}

export interface RejectInput {
  orgId: string;
  intakeId: string;
  userId: string;
  reason: string;
}

export const INTAKE_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_XML_MIMES = new Set(['application/xml', 'text/xml']);
export const ALLOWED_PDF_MIMES = new Set(['application/pdf']);

export const R2_CONTENT_TYPES = {
  pdf: 'application/pdf',
  xml: 'application/xml',
  html: 'text/html; charset=utf-8',
} as const;
