import { cf, isoDate, splitName } from '../../lib/format.js';
import type { PayrollFeedEmployee } from '../../types/feed.js';

// Shared US feed -> row projection. The three US CSV targets (ADP, Gusto,
// QuickBooks) each project this normalized row onto their own column contract.
//
// The full SSN is NOT here — the row carries `ssnLast4` and a masked display
// form (`***-**-NNNN`). Where an incumbent import legally requires the full SSN,
// the API feed-builder reveals it upstream via the audited employeePii:read
// path (never a mapper field, never logged).
export interface UsPayrollRow {
  firstName: string;
  lastName: string;
  fullName: string;
  ssnLast4: string;
  ssnMasked: string;
  filingStatus: string;
  workState: string;
  otherState: string;
  hireDate: string;
  terminatedAt: string;
}

export function mapUsEmployeeToRow(employee: PayrollFeedEmployee): UsPayrollRow {
  const { firstNames, surname } = splitName(employee.displayName);
  const ssnLast4 = employee.nationalIdLast4 ?? '';
  return {
    firstName: firstNames,
    lastName: surname,
    fullName: employee.displayName,
    ssnLast4,
    ssnMasked: ssnLast4 ? `***-**-${ssnLast4}` : '',
    filingStatus: cf(employee, 'filingStatus'),
    workState: cf(employee, 'stateWithholding'),
    otherState: cf(employee, 'stateOther'),
    hireDate: isoDate(employee.hireDate),
    terminatedAt: isoDate(employee.terminatedAt),
  };
}
