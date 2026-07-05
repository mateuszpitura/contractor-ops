import { toCsvBuffer } from '../../lib/csv-writer.js';
import type { PayrollFeed } from '../../types/feed.js';
import { mapUsEmployeeToRow } from '../us-shared/mapper.js';

// Gusto employee-import column contract. Locked by a golden fixture. This CSV is
// the fallback the native Gusto OAuth bridge profile delegates to when the
// payroll.gusto flag is dark or the org is not connected.
export const GUSTO_CSV_COLUMNS = [
  'First name',
  'Last name',
  'SSN',
  'Filing status',
  'Work state',
  'Hire date',
] as const;

export async function generateGustoCsv(feed: PayrollFeed): Promise<Buffer> {
  const rows = feed.employees.map(e => {
    const r = mapUsEmployeeToRow(e);
    return [r.firstName, r.lastName, r.ssnMasked, r.filingStatus, r.workState, r.hireDate];
  });
  return toCsvBuffer([...GUSTO_CSV_COLUMNS], rows, ',');
}
