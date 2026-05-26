/**
 * URL param parsing for e-invoice compliance client-side filter.
 * Extracted from apps/web einvoice-compliance-filter-chips (table-only).
 */

export const COMPLIANCE_FILTER_VALUES = [
  'all',
  'notGenerated',
  'valid',
  'warnings',
  'invalid',
  'transmitted',
  'failed',
] as const;

export type EInvoiceComplianceFilter = (typeof COMPLIANCE_FILTER_VALUES)[number];

export function parseFilterParam(raw: string | null): EInvoiceComplianceFilter[] {
  if (!raw) return ['all'];
  const tokens = raw.split(',').map(t => t.trim());
  const allowed = new Set<EInvoiceComplianceFilter>(COMPLIANCE_FILTER_VALUES);
  const parsed = tokens.filter((t): t is EInvoiceComplianceFilter =>
    allowed.has(t as EInvoiceComplianceFilter),
  );
  if (parsed.length === 0) return ['all'];
  if (parsed.includes('all')) return ['all'];
  return parsed;
}
