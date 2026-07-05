// Two-org cross-leak regression for the payroll export feed — RED until
// services/payroll-feed lands. buildPayrollFeed is org-scoped: an ORG_A caller
// can never assemble a feed containing ORG_B employees, even when passing an
// ORG_B employeeId. Terminal-RED today (the service module does not exist yet).

import { describe, expect, it } from 'vitest';

import { buildPayrollFeed } from '../../services/payroll-feed.js';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';

interface WorkerRow {
  id: string;
  organizationId: string;
  workerType: string;
  displayName: string;
  email: string | null;
  employeeProfile: Record<string, unknown> | null;
  personnelFile: Record<string, unknown> | null;
}

const makeRow = (id: string, org: string): WorkerRow => ({
  id,
  organizationId: org,
  workerType: 'EMPLOYEE',
  displayName: 'Test Employee',
  email: null,
  employeeProfile: {
    countryCode: 'PL',
    countryFields: {},
    etat: '1.00',
    employmentStatus: 'ACTIVE',
    peselLast4: '0000',
    ssnLast4: null,
  },
  personnelFile: { hireDate: new Date('2024-01-01T00:00:00.000Z'), terminatedAt: null },
});

// Fake db honouring the injected organizationId in the where — the stand-in for
// withTenantScope: a query scoped to ORG_A never matches an ORG_B row.
function scopedDb(rows: WorkerRow[]) {
  return {
    worker: {
      findMany: async (args: {
        where: { workerType: string; organizationId: string; id: { in: string[] } };
      }) => {
        const { where } = args;
        return rows.filter(
          r =>
            r.workerType === where.workerType &&
            r.organizationId === where.organizationId &&
            where.id.in.includes(r.id),
        );
      },
    },
  };
}

describe('payroll export — cross-org isolation', () => {
  const rows = [makeRow('wrk-a-001', ORG_A), makeRow('wrk-b-001', ORG_B)];

  it('never assembles an ORG_B employee into an ORG_A feed', async () => {
    const feed = await buildPayrollFeed(scopedDb(rows) as never, ORG_A, ['wrk-a-001', 'wrk-b-001']);
    expect(feed.employees.map(e => e.workerId)).toEqual(['wrk-a-001']);
    expect(feed.employees.some(e => e.workerId === 'wrk-b-001')).toBe(false);
  });

  it('returns an empty employee set when an ORG_A caller requests only ORG_B ids', async () => {
    const feed = await buildPayrollFeed(scopedDb(rows) as never, ORG_A, ['wrk-b-001']);
    expect(feed.employees).toHaveLength(0);
  });
});
