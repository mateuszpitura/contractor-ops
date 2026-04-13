/**
 * Import processor service for CSV/XLSX file parsing, column auto-mapping,
 * row validation, and duplicate detection.
 *
 * Supports contractor and contract entity types.
 */

import { prisma } from '@contractor-ops/db';
import * as E from '../errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportRow = {
  rowNumber: number;
  data: Record<string, unknown>;
  status: 'valid' | 'invalid' | 'duplicate';
  errors: Array<{ field: string; message: string }>;
  duplicateOf?: string;
};

export type ImportResult = {
  validRows: ImportRow[];
  invalidRows: ImportRow[];
  duplicateRows: ImportRow[];
  totalRows: number;
  columnMapping: Record<string, string | null>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_IMPORT_ROWS = 5000;

// ---------------------------------------------------------------------------
// Field alias maps
// ---------------------------------------------------------------------------

export const CONTRACTOR_FIELD_ALIASES: Record<string, string[]> = {
  legalName: ['legalname', 'companyname', 'company', 'name', 'nazwa', 'nazwafirmy'],
  taxId: ['taxid', 'nip', 'nipnumber', 'taxnumber'],
  email: ['email', 'emailaddress', 'mail', 'kontakt'],
  displayName: ['displayname', 'shortname', 'tradingname', 'nazwahandlowa'],
  type: ['type', 'contractortype', 'typkontrahenta', 'rodzaj'],
  vatId: ['vatid', 'vateu', 'euvatid', 'nrvat'],
  phone: ['phone', 'phonenumber', 'telefon'],
  countryCode: ['countrycode', 'country', 'kraj'],
  currency: ['currency', 'waluta'],
};

export const CONTRACT_FIELD_ALIASES: Record<string, string[]> = {
  title: ['title', 'contracttitle', 'name', 'nazwa', 'tytul'],
  type: ['type', 'contracttype', 'rodzaj'],
  startDate: ['startdate', 'start', 'datapoczatku', 'od'],
  endDate: ['enddate', 'end', 'datakonca', 'do'],
  contractorTaxId: ['contractortaxid', 'nip', 'nipkontrahenta', 'taxid'],
};

// ---------------------------------------------------------------------------
// Header normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a column header by lowercasing and stripping non-alphanumeric chars.
 */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]/g, '');
}

// ---------------------------------------------------------------------------
// Column auto-mapping
// ---------------------------------------------------------------------------

/**
 * Auto-maps source column headers to target entity fields by alias matching.
 * Returns a mapping from target field name to source header (or null if no match).
 */
export function autoMapColumns(
  sourceHeaders: string[],
  entityType: 'contractor' | 'contract',
): Record<string, string | null> {
  const aliases = entityType === 'contractor' ? CONTRACTOR_FIELD_ALIASES : CONTRACT_FIELD_ALIASES;

  const normalizedSources = sourceHeaders.map(h => ({
    original: h,
    normalized: normalizeHeader(h),
  }));

  const mapping: Record<string, string | null> = {};

  for (const [field, fieldAliases] of Object.entries(aliases)) {
    const match = normalizedSources.find(src => fieldAliases.includes(src.normalized));
    mapping[field] = match?.original ?? null;
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Row validators
// ---------------------------------------------------------------------------

/**
 * Validates a single contractor row against required fields.
 * Applies defaults: type -> "COMPANY", countryCode -> "PL", currency -> "PLN".
 */
export function validateContractorRow(row: Record<string, unknown>): {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
} {
  const errors: Array<{ field: string; message: string }> = [];

  // Required fields
  if (!row.legalName || String(row.legalName).trim() === '') {
    errors.push({ field: 'legalName', message: E.VALIDATION_LEGAL_NAME_REQUIRED });
  }

  if (!row.taxId || String(row.taxId).trim() === '') {
    errors.push({ field: 'taxId', message: E.VALIDATION_TAX_ID_REQUIRED });
  }

  if (!row.email || String(row.email).trim() === '') {
    errors.push({ field: 'email', message: E.VALIDATION_EMAIL_REQUIRED });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(row.email).trim())) {
      errors.push({ field: 'email', message: E.VALIDATION_EMAIL_INVALID });
    }
  }

  // Apply defaults (mutate row in place for downstream)
  if (!row.type || String(row.type).trim() === '') {
    row.type = 'COMPANY';
  }
  if (!row.countryCode || String(row.countryCode).trim() === '') {
    row.countryCode = 'PL';
  }
  if (!row.currency || String(row.currency).trim() === '') {
    row.currency = 'PLN';
  }

  // Validate type enum
  const validTypes = ['SOLE_TRADER', 'COMPANY', 'INDIVIDUAL_FREELANCER', 'OTHER'];
  if (row.type && !validTypes.includes(String(row.type).toUpperCase())) {
    errors.push({
      field: 'type',
      message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
    });
  }

  // Validate countryCode length
  if (row.countryCode && String(row.countryCode).trim().length !== 2) {
    errors.push({
      field: 'countryCode',
      message: E.VALIDATION_COUNTRY_CODE_LENGTH,
    });
  }

  // Validate currency length
  if (row.currency && String(row.currency).trim().length !== 3) {
    errors.push({
      field: 'currency',
      message: E.VALIDATION_CURRENCY_LENGTH,
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a single contract row against required fields.
 */
export function validateContractRow(row: Record<string, unknown>): {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
} {
  const errors: Array<{ field: string; message: string }> = [];

  if (!row.title || String(row.title).trim() === '') {
    errors.push({ field: 'title', message: E.VALIDATION_CONTRACT_TITLE_REQUIRED });
  }

  if (!row.type || String(row.type).trim() === '') {
    errors.push({ field: 'type', message: E.VALIDATION_CONTRACT_TYPE_REQUIRED });
  } else {
    const validTypes = [
      'B2B_MASTER_SERVICE',
      'STATEMENT_OF_WORK',
      'NDA',
      'IP_ASSIGNMENT',
      'DPA',
      'OTHER',
    ];
    if (!validTypes.includes(String(row.type).toUpperCase())) {
      errors.push({
        field: 'type',
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }
  }

  if (!row.startDate || String(row.startDate).trim() === '') {
    errors.push({ field: 'startDate', message: E.VALIDATION_START_DATE_REQUIRED });
  } else {
    const parsed = new Date(String(row.startDate));
    if (Number.isNaN(parsed.getTime())) {
      errors.push({ field: 'startDate', message: E.VALIDATION_DATE_INVALID });
    }
  }

  if (!row.contractorTaxId || String(row.contractorTaxId).trim() === '') {
    errors.push({
      field: 'contractorTaxId',
      message: E.VALIDATION_TAX_ID_FK_REQUIRED,
    });
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// File parser
// ---------------------------------------------------------------------------

/**
 * Parses a CSV or XLSX file buffer into an array of row objects.
 * Uses xlsx library with cellDates: true to handle Excel date serials.
 * Enforces a max row limit.
 */
export async function parseImportFile(buffer: Buffer): Promise<Record<string, string>[]> {
  const { default: XLSX } = await import('xlsx');

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File contains no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Sheet not found in workbook');
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`File exceeds maximum of ${MAX_IMPORT_ROWS} rows (found ${rows.length})`);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

/**
 * Processes an import file: parses, applies column mapping, validates rows,
 * and detects duplicates against existing database records.
 */
export async function processImportFile(
  buffer: Buffer,
  entityType: 'contractor' | 'contract',
  organizationId: string,
  columnMapping: Record<string, string | null>,
): Promise<ImportResult> {
  const rawRows = await parseImportFile(buffer);
  const mappedRows = applyColumnMapping(rawRows, columnMapping);

  const { validRows, invalidRows } = validateRows(mappedRows, entityType);
  const duplicateRows: ImportRow[] = [];

  // Post-validation: duplicate detection / FK resolution
  if (entityType === 'contractor') {
    await detectContractorDuplicates(validRows, duplicateRows, organizationId);
  } else {
    await resolveContractorForeignKeys(validRows, invalidRows, organizationId);
  }

  return {
    validRows,
    invalidRows,
    duplicateRows,
    totalRows: rawRows.length,
    columnMapping,
  };
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

function applyColumnMapping(
  rawRows: Record<string, string>[],
  columnMapping: Record<string, string | null>,
): Array<{ rowNumber: number; data: Record<string, unknown> }> {
  const reverseMapping: Record<string, string> = {};
  for (const [targetField, sourceHeader] of Object.entries(columnMapping)) {
    if (sourceHeader) {
      reverseMapping[sourceHeader] = targetField;
    }
  }

  return rawRows.map((raw, idx) => {
    const mapped: Record<string, unknown> = {};
    for (const [sourceHeader, value] of Object.entries(raw)) {
      const targetField = reverseMapping[sourceHeader];
      if (targetField) {
        mapped[targetField] = value;
      }
    }
    return { rowNumber: idx + 1, data: mapped };
  });
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

function validateRows(
  mappedRows: Array<{ rowNumber: number; data: Record<string, unknown> }>,
  entityType: 'contractor' | 'contract',
): { validRows: ImportRow[]; invalidRows: ImportRow[] } {
  const validator = entityType === 'contractor' ? validateContractorRow : validateContractRow;
  const validRows: ImportRow[] = [];
  const invalidRows: ImportRow[] = [];

  for (const { rowNumber, data } of mappedRows) {
    const { valid, errors } = validator({ ...data });
    if (valid) {
      validRows.push({ rowNumber, data, status: 'valid', errors: [] });
    } else {
      invalidRows.push({ rowNumber, data, status: 'invalid', errors });
    }
  }

  return { validRows, invalidRows };
}

// ---------------------------------------------------------------------------
// Duplicate detection (contractor imports)
// ---------------------------------------------------------------------------

async function detectContractorDuplicates(
  validRows: ImportRow[],
  duplicateRows: ImportRow[],
  organizationId: string,
): Promise<void> {
  const taxIds = validRows.map(r => String(r.data.taxId ?? '').trim()).filter(Boolean);
  if (taxIds.length === 0) return;

  const existing = await prisma.contractor.findMany({
    where: { organizationId, taxId: { in: taxIds }, deletedAt: null },
    select: { id: true, taxId: true },
  });

  const existingByTaxId = new Map(existing.map(c => [c.taxId, c.id]));

  const stillValid: ImportRow[] = [];
  for (const row of validRows) {
    const taxId = String(row.data.taxId ?? '').trim();
    const existingId = existingByTaxId.get(taxId);
    if (existingId) {
      duplicateRows.push({ ...row, status: 'duplicate', duplicateOf: existingId });
    } else {
      stillValid.push(row);
    }
  }
  validRows.length = 0;
  validRows.push(...stillValid);
}

// ---------------------------------------------------------------------------
// FK resolution (contract imports)
// ---------------------------------------------------------------------------

async function resolveContractorForeignKeys(
  validRows: ImportRow[],
  invalidRows: ImportRow[],
  organizationId: string,
): Promise<void> {
  const taxIds = validRows.map(r => String(r.data.contractorTaxId ?? '').trim()).filter(Boolean);
  if (taxIds.length === 0) return;

  const contractors = await prisma.contractor.findMany({
    where: { organizationId, taxId: { in: taxIds }, deletedAt: null },
    select: { id: true, taxId: true },
  });

  const contractorByTaxId = new Map(contractors.map(c => [c.taxId, c.id]));

  const stillValid: ImportRow[] = [];
  for (const row of validRows) {
    const taxId = String(row.data.contractorTaxId ?? '').trim();
    const contractorId = contractorByTaxId.get(taxId);
    if (contractorId) {
      row.data.contractorId = contractorId;
      stillValid.push(row);
    } else {
      invalidRows.push({
        ...row,
        status: 'invalid',
        errors: [{ field: 'contractorTaxId', message: `No contractor found with tax ID: ${taxId}` }],
      });
    }
  }
  validRows.length = 0;
  validRows.push(...stillValid);
}
