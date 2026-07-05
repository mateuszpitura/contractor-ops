import { toCsvBuffer } from '../../lib/csv-writer.js';
import type { PayrollFeed } from '../../types/feed.js';
import { mapUsEmployeeToRow } from '../us-shared/mapper.js';

// QuickBooks Payroll employee-import column contract. Locked by a golden fixture.
// This CSV is the fallback the native QuickBooks OAuth bridge profile delegates
// to when the payroll.quickbooks flag is dark or the org is not connected.
export const QUICKBOOKS_CSV_COLUMNS = [
  'Employee',
  'SSN',
  'Filing Status',
  'State',
  'Hire Date',
] as const;

export async function generateQuickbooksCsv(feed: PayrollFeed): Promise<Buffer> {
  const rows = feed.employees.map(e => {
    const r = mapUsEmployeeToRow(e);
    return [r.fullName, r.ssnMasked, r.filingStatus, r.workState, r.hireDate];
  });
  return toCsvBuffer([...QUICKBOOKS_CSV_COLUMNS], rows, ',');
}
