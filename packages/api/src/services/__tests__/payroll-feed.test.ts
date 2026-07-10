// Feed-builder join + PII-mask contract — RED until services/payroll-feed lands.
//
// buildPayrollFeed joins Worker -> EmployeeProfile -> PersonnelFile, reads the
// hire/termination anchors off PersonnelFile (NOT EmployeeProfile), and masks
// national IDs to last-4 (never a full PESEL/SSN in the feed). Terminal-RED
// today: the service module does not exist yet.

import { describe, expect, it } from 'vitest';

import { buildPayrollFeed } from '../../services/payroll-feed.js';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';

interface WorkerRow {
  id: string;
  organizationId: string;
  workerType: string;
  displayName: string;
  email: string | null;
  employeeProfile: Record<string, unknown> | null;
  personnelFile: Record<string, unknown> | null;
}

function fakeDb(rows: WorkerRow[]) {
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

const anna: WorkerRow = {
  id: 'wrk-pl-001',
  organizationId: ORG_A,
  workerType: 'EMPLOYEE',
  displayName: 'Anna Kowalska',
  email: 'anna.kowalska@example.pl',
  employeeProfile: {
    countryCode: 'PL',
    countryFields: { stanowisko: 'Programista' },
    etat: '1.00',
    employmentStatus: 'ACTIVE',
    peselLast4: '3210',
    ssnLast4: null,
  },
  personnelFile: { hireDate: new Date('2024-01-15T00:00:00.000Z'), terminatedAt: null },
};

describe('buildPayrollFeed', () => {
  it('joins Worker+EmployeeProfile+PersonnelFile and masks the national ID to last-4', async () => {
    const { feed } = await buildPayrollFeed(fakeDb([anna]) as never, ORG_A, ['wrk-pl-001']);

    expect(feed.organizationId).toBe(ORG_A);
    expect(feed.employees).toHaveLength(1);
    const [e] = feed.employees;
    expect(e.workerId).toBe('wrk-pl-001');
    expect(e.countryCode).toBe('PL');
    expect(e.hireDate).toBe('2024-01-15');
    expect(e.terminatedAt).toBeNull();
    expect(e.employmentStatus).toBe('ACTIVE');
    expect(e.etat).toBe('1.00');
    // last-4 only — never the full PESEL
    expect(e.nationalIdLast4).toBe('3210');
    expect(JSON.stringify(e)).not.toContain('peselEncrypted');
  });

  it('reads the termination anchor from PersonnelFile', async () => {
    const terminated: WorkerRow = {
      ...anna,
      id: 'wrk-pl-002',
      personnelFile: {
        hireDate: new Date('2023-06-01T00:00:00.000Z'),
        terminatedAt: new Date('2025-03-31T00:00:00.000Z'),
      },
    };
    const { feed } = await buildPayrollFeed(fakeDb([terminated]) as never, ORG_A, ['wrk-pl-002']);
    expect(feed.employees[0].terminatedAt).toContain('2025-03-31');
  });
});
