import { toCsvBuffer } from '../../lib/csv-writer.js';
import type { PayrollFeed } from '../../types/feed.js';
import { mapUsEmployeeToRow } from '../us-shared/mapper.js';

// ADP Workforce Now employee-import column contract. Locked by a golden fixture;
// native ADP API push is deferred to v7.1 (Marketplace partner + mTLS) — this CSV
// is the v7.0 ADP path. Vendor correctness is a deferred adviser-verify checkpoint.
export const ADP_COLUMNS = [
  'Last Name',
  'First Name',
  'SSN',
  'Filing Status',
  'Work State',
  'Other State',
  'Hire Date',
  'Termination Date',
] as const;

export async function generateAdpCsv(feed: PayrollFeed): Promise<Buffer> {
  const rows = feed.employees.map(e => {
    const r = mapUsEmployeeToRow(e);
    return [
      r.lastName,
      r.firstName,
      r.ssnMasked,
      r.filingStatus,
      r.workState,
      r.otherState,
      r.hireDate,
      r.terminatedAt,
    ];
  });
  return toCsvBuffer([...ADP_COLUMNS], rows, ',');
}
