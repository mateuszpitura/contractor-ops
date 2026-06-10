import type {
  InvoiceIntakeProfileLevel,
  InvoiceIntakeStatus,
  InvoiceIntakeValidationStatus,
} from '@contractor-ops/db/generated/prisma/client';
import type { XRechnungValidationReport, ZugferdConformanceLevel } from '@contractor-ops/einvoice';

import type { IntakeServiceError, IntakeServiceErrorCode } from './types.js';

export function makeError(
  code: IntakeServiceErrorCode,
  message: string,
  details?: unknown,
): IntakeServiceError {
  return details === undefined ? { code, message } : { code, message, details };
}

export function mapConformanceToProfileLevel(
  level: ZugferdConformanceLevel,
): InvoiceIntakeProfileLevel {
  switch (level) {
    case 'COMFORT':
      return 'COMFORT';
    case 'XRECHNUNG':
      return 'XRECHNUNG';
    case 'EXTENDED':
      return 'EXTENDED';
    default: {
      const never: never = level;
      throw new Error(`Unsupported ZUGFeRD conformance level: ${String(never)}`);
    }
  }
}

export function deriveIntakeStatus(
  validationStatus: InvoiceIntakeValidationStatus,
  profileLevel: ZugferdConformanceLevel,
): InvoiceIntakeStatus {
  if (validationStatus === 'VALID' && profileLevel !== 'EXTENDED') {
    return 'PARSED';
  }
  return 'NEEDS_REVIEW';
}

export function firstXsdErrors(report: XRechnungValidationReport, n: number): string[] {
  const xsd = report.layers.find(l => l.layer === 'XSD');
  if (!xsd) return [];
  return xsd.errors.slice(0, n).map(e => `${e.ruleId}: ${e.message}`);
}

export function isXsdFailure(report: XRechnungValidationReport): boolean {
  const xsd = report.layers.find(l => l.layer === 'XSD');
  if (!xsd) return false;
  return xsd.status === 'FAIL' || xsd.errors.length > 0;
}

export function flattenWarnings(report: XRechnungValidationReport): string[] {
  const out: string[] = [];
  for (const layer of report.layers) {
    for (const w of layer.warnings) {
      out.push(`${layer.layer}:${w.ruleId}: ${w.message}`);
    }
  }
  return out;
}

export function deriveValidationStatus(
  report: XRechnungValidationReport,
): InvoiceIntakeValidationStatus {
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

export function isUniqueConstraintViolation(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return code === 'P2002';
}
