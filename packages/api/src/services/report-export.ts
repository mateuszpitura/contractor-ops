/**
 * CSV generation functions for reports and audit log export.
 * Uses xlsx library with BOM for Polish character support.
 * Phase 46: Added home-currency conversion for multi-currency reports.
 */

import { minorToDecimalStr } from '@contractor-ops/shared';
import { convertAmount } from './exchange-rate.js';
import type { DbClient } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CsvColumn = {
  key: string;
  header: string;
};

type AuditLogItem = {
  id: string;
  actorName: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  oldValuesJson: unknown;
  newValuesJson: unknown;
  metadataJson: unknown;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Core CSV generator
// ---------------------------------------------------------------------------

/**
 * Generate a CSV file from rows with specified column definitions.
 * Uses xlsx library for proper escaping. Adds UTF-8 BOM for Polish characters.
 * Returns base64-encoded CSV string.
 */
export async function generateReportCsv(
  columns: CsvColumn[],
  rows: Record<string, unknown>[],
): Promise<{ data: string; mimeType: string }> {
  const { default: XLSX } = await import('xlsx');

  // Map rows to use header names as keys
  const mappedRows = rows.map(row => {
    const mapped: Record<string, unknown> = {};
    for (const col of columns) {
      mapped[col.header] = row[col.key] ?? '';
    }
    return mapped;
  });

  const worksheet = XLSX.utils.json_to_sheet(mappedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  const csvBuffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'csv',
  }) as Buffer;

  // Prepend UTF-8 BOM for Excel Polish character support
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const withBom = Buffer.concat([bom, csvBuffer]);

  return {
    data: withBom.toString('base64'),
    mimeType: 'text/csv',
  };
}

// ---------------------------------------------------------------------------
// Audit log CSV
// ---------------------------------------------------------------------------

/**
 * Generate audit log CSV with columns per D-16 spec.
 */
export async function generateAuditCsv(
  items: AuditLogItem[],
): Promise<{ data: string; mimeType: string }> {
  const columns: CsvColumn[] = [
    { key: 'timestamp', header: 'Timestamp' },
    { key: 'actorName', header: 'Actor Name' },
    { key: 'actorType', header: 'Actor Type' },
    { key: 'action', header: 'Action' },
    { key: 'resourceType', header: 'Resource Type' },
    { key: 'resourceName', header: 'Resource Name' },
    { key: 'resourceId', header: 'Resource ID' },
    { key: 'changedFields', header: 'Changed Fields' },
  ];

  const rows = items.map(item => {
    // Compute changed fields from oldValuesJson/newValuesJson
    const oldVals =
      item.oldValuesJson && typeof item.oldValuesJson === 'object'
        ? (item.oldValuesJson as Record<string, unknown>)
        : {};
    const newVals =
      item.newValuesJson && typeof item.newValuesJson === 'object'
        ? (item.newValuesJson as Record<string, unknown>)
        : {};
    const allKeys = new Set([...Object.keys(oldVals), ...Object.keys(newVals)]);
    const changedKeys: string[] = [];
    for (const key of allKeys) {
      if (JSON.stringify(oldVals[key]) !== JSON.stringify(newVals[key])) {
        changedKeys.push(key);
      }
    }

    return {
      timestamp: item.createdAt.toISOString(),
      actorName: item.actorName ?? '',
      actorType: item.actorType,
      action: item.action,
      resourceType: item.resourceType,
      resourceName: item.resourceName ?? '',
      resourceId: item.resourceId,
      changedFields: changedKeys.join(', '),
    };
  });

  return generateReportCsv(columns, rows);
}

// ---------------------------------------------------------------------------
// Report-specific CSV generators
// ---------------------------------------------------------------------------

/**
 * Spend by contractor report CSV.
 */
export async function generateSpendCsv(
  items: Array<{
    contractorName: string;
    invoiceCount: number;
    totalMinor: number;
    avgMinor: number;
    lastPaidAt: string | null;
  }>,
): Promise<{ data: string; mimeType: string }> {
  const columns: CsvColumn[] = [
    { key: 'contractorName', header: 'Contractor' },
    { key: 'invoiceCount', header: 'Invoice Count' },
    { key: 'totalAmount', header: 'Total Amount' },
    { key: 'avgAmount', header: 'Average Amount' },
    { key: 'lastPaidAt', header: 'Last Paid' },
  ];

  const rows = items.map(item => ({
    contractorName: item.contractorName,
    invoiceCount: item.invoiceCount,
    totalAmount: minorToDecimalStr(item.totalMinor, 'PLN'),
    avgAmount: minorToDecimalStr(item.avgMinor, 'PLN'),
    lastPaidAt: item.lastPaidAt ?? '',
  }));

  return generateReportCsv(columns, rows);
}

/**
 * Expiring contracts report CSV.
 */
export async function generateContractsCsv(
  items: Array<{
    contractTitle: string;
    contractorName: string;
    endDate: string;
    daysRemaining: number;
    status: string;
  }>,
): Promise<{ data: string; mimeType: string }> {
  const columns: CsvColumn[] = [
    { key: 'contractTitle', header: 'Contract' },
    { key: 'contractorName', header: 'Contractor' },
    { key: 'endDate', header: 'End Date' },
    { key: 'daysRemaining', header: 'Days Remaining' },
    { key: 'status', header: 'Status' },
  ];

  return generateReportCsv(columns, items as unknown as Record<string, unknown>[]);
}

/**
 * Overdue invoices report CSV.
 */
export async function generateInvoicesCsv(
  items: Array<{
    invoiceNumber: string;
    contractorName: string;
    amountMinor: number;
    currency: string;
    dueDate: string;
    daysOverdue: number;
    status: string;
  }>,
): Promise<{ data: string; mimeType: string }> {
  const columns: CsvColumn[] = [
    { key: 'invoiceNumber', header: 'Invoice Number' },
    { key: 'contractorName', header: 'Contractor' },
    { key: 'amount', header: 'Amount' },
    { key: 'currency', header: 'Currency' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'daysOverdue', header: 'Days Overdue' },
    { key: 'status', header: 'Status' },
  ];

  const rows = items.map(item => ({
    invoiceNumber: item.invoiceNumber,
    contractorName: item.contractorName,
    amount: minorToDecimalStr(item.amountMinor, item.currency),
    currency: item.currency,
    dueDate: item.dueDate,
    daysOverdue: item.daysOverdue,
    status: item.status,
  }));

  return generateReportCsv(columns, rows);
}

/**
 * Compliance gaps report CSV.
 */
export async function generateComplianceCsv(
  items: Array<{
    contractorName: string;
    missingDocuments: number;
    contractStatus: string;
    overdueTasks: number;
    health: string;
  }>,
): Promise<{ data: string; mimeType: string }> {
  const columns: CsvColumn[] = [
    { key: 'contractorName', header: 'Contractor' },
    { key: 'missingDocuments', header: 'Missing Documents' },
    { key: 'contractStatus', header: 'Contract Status' },
    { key: 'overdueTasks', header: 'Overdue Tasks' },
    { key: 'health', header: 'Health' },
  ];

  return generateReportCsv(columns, items as unknown as Record<string, unknown>[]);
}

// ---------------------------------------------------------------------------
// Home Currency Conversion (Phase 46)
// ---------------------------------------------------------------------------

/**
 * Convert a minor-unit amount to the organization's home currency for report display.
 * Returns the original amount unchanged if currencies match.
 * Returns null if conversion is not possible (missing rate).
 * Per CURR-05: display-only conversion, not FX settlement.
 */
export async function convertToHomeCurrency(
  prisma: DbClient,
  amountMinor: number,
  fromCurrency: string,
  homeCurrency: string,
  date?: Date,
): Promise<{ amountMinor: number; rate: number } | null> {
  if (fromCurrency === homeCurrency) {
    return { amountMinor, rate: 1 };
  }
  const result = await convertAmount(
    prisma as unknown as Parameters<typeof convertAmount>[0],
    amountMinor,
    fromCurrency,
    homeCurrency,
    date,
  );
  if (!result) return null;
  return { amountMinor: result.amountMinor, rate: result.rate };
}
