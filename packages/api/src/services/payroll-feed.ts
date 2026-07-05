// Payroll export feed-builder.
//
// Assembles the PII-masked PayrollFeed the payroll export profiles map from by
// joining the three tenant-owning models: Worker (identity) -> EmployeeProfile
// (per-market fields + encrypted-ID last-4) -> PersonnelFile (hire/termination
// anchors). The hire/termination dates live on PersonnelFile, NOT on
// EmployeeProfile. National identifiers are masked to last-4 here; a full
// identifier is never assembled into the feed (a format that legally requires
// it reveals it through the audited employeePii:read path — not wired for the
// v7.0 shipping formats, which use last-4 + countryFields market references).

import type { PayrollFeed } from '@contractor-ops/payroll';
import { payrollFeedSchema } from '@contractor-ops/payroll';

interface EmployeeProfileRow {
  countryCode: string;
  countryFields: unknown;
  etat: unknown;
  employmentStatus: string | null;
  peselLast4?: string | null;
  ssnLast4?: string | null;
  iqamaLast4?: string | null;
  emiratesIdLast4?: string | null;
}

interface PersonnelFileRow {
  hireDate: Date | null;
  terminatedAt: Date | null;
}

interface WorkerRow {
  id: string;
  displayName: string;
  email: string | null;
  employeeProfile: EmployeeProfileRow | null;
  personnelFile: PersonnelFileRow | null;
}

/** Minimal structural view of the tenant-scoped Prisma client this reads. */
export interface PayrollFeedDb {
  worker: {
    findMany: (args: {
      where: { workerType: 'EMPLOYEE'; organizationId: string; id: { in: string[] } };
      include: { employeeProfile: true; personnelFile: true };
    }) => Promise<WorkerRow[]>;
  };
}

function nationalIdLast4(countryCode: string, profile: EmployeeProfileRow): string | null {
  switch (countryCode) {
    case 'PL':
      return profile.peselLast4 ?? null;
    case 'US':
      return profile.ssnLast4 ?? null;
    case 'SA':
      return profile.iqamaLast4 ?? null;
    case 'AE':
      return profile.emiratesIdLast4 ?? null;
    default:
      return null;
  }
}

function toIsoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/**
 * Build a PII-masked, org-scoped PayrollFeed for the given employees. The
 * `organizationId` is injected into the query (defense-in-depth over the
 * withTenantScope predicate the `db` client already carries), so a cross-org
 * employeeId can never surface another org's record.
 */
export async function buildPayrollFeed(
  db: PayrollFeedDb,
  organizationId: string,
  employeeIds: string[],
): Promise<PayrollFeed> {
  const workers = await db.worker.findMany({
    where: { workerType: 'EMPLOYEE', organizationId, id: { in: employeeIds } },
    include: { employeeProfile: true, personnelFile: true },
  });

  const employees = workers
    .filter(
      (w): w is WorkerRow & { employeeProfile: EmployeeProfileRow } => w.employeeProfile != null,
    )
    .map(w => {
      const profile = w.employeeProfile;
      const etat = profile.etat;
      return {
        workerId: w.id,
        displayName: w.displayName,
        email: w.email,
        countryCode: profile.countryCode,
        hireDate: toIsoDate(w.personnelFile?.hireDate ?? null),
        terminatedAt: w.personnelFile?.terminatedAt
          ? w.personnelFile.terminatedAt.toISOString()
          : null,
        employmentStatus:
          (profile.employmentStatus as PayrollFeed['employees'][number]['employmentStatus']) ??
          null,
        etat: etat == null ? null : Number(etat).toFixed(2),
        nationalIdLast4: nationalIdLast4(profile.countryCode, profile),
        countryFields: (profile.countryFields ?? {}) as Record<string, unknown>,
      };
    });

  return payrollFeedSchema.parse({
    organizationId,
    generatedAt: new Date().toISOString(),
    targetCountry: employees[0]?.countryCode ?? '',
    employees,
  });
}
