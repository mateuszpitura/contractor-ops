// Shared Wave-0 fixtures for the leave + employee-time surface.
//
// Pure builders only — this module imports no leave/time runtime module and no
// generated Prisma delegate, so it registers clean regardless of migration
// state. Consumers pass the returned plain objects into their own mock clients.

const MINUTES_PER_LEAVE_DAY = 480;

export interface WorkerFixture {
  id: string;
  organizationId: string;
  workerType: 'EMPLOYEE';
  countryCode: string;
}

export interface EmployeeProfileFixture {
  id: string;
  organizationId: string;
  workerId: string;
  countryCode: string;
  etat: number | null;
  employmentStatus: 'ACTIVE' | 'TERMINATED';
  hireDate: Date;
}

export interface EmployeeWithProfile {
  worker: WorkerFixture;
  profile: EmployeeProfileFixture;
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/**
 * Builds a Worker(EMPLOYEE) + EmployeeProfile pair with a chosen employment
 * fraction. `etat: null` models an unset fraction (balance math must treat it
 * as full-time, never throw).
 */
export function makeEmployeeWithProfile(
  opts: {
    organizationId?: string;
    countryCode?: string;
    etat?: number | null;
    employmentStatus?: 'ACTIVE' | 'TERMINATED';
    hireDate?: Date;
  } = {},
): EmployeeWithProfile {
  const organizationId = opts.organizationId ?? 'org-fixture-0001';
  const countryCode = opts.countryCode ?? 'PL';
  const workerId = nextId('worker');
  return {
    worker: { id: workerId, organizationId, workerType: 'EMPLOYEE', countryCode },
    profile: {
      id: nextId('emp-profile'),
      organizationId,
      workerId,
      countryCode,
      etat: opts.etat === undefined ? 1 : opts.etat,
      employmentStatus: opts.employmentStatus ?? 'ACTIVE',
      hireDate: opts.hireDate ?? new Date('2020-01-01'),
    },
  };
}

export interface PublicHolidayFixture {
  countryCode: string;
  holidayDate: Date;
  name: string;
  region: string | null;
}

/**
 * A small seeded holiday set spanning every supported market, enough for
 * weekend/holiday-premium and working-day math in the leave + ewidencja tests.
 */
export const PUBLIC_HOLIDAY_FIXTURES: readonly PublicHolidayFixture[] = [
  { countryCode: 'PL', holidayDate: new Date('2026-01-01'), name: 'Nowy Rok', region: null },
  { countryCode: 'PL', holidayDate: new Date('2026-05-01'), name: 'Święto Pracy', region: null },
  { countryCode: 'DE', holidayDate: new Date('2026-01-01'), name: 'Neujahr', region: null },
  {
    countryCode: 'DE',
    holidayDate: new Date('2026-10-03'),
    name: 'Tag der Deutschen Einheit',
    region: null,
  },
  { countryCode: 'GB', holidayDate: new Date('2026-01-01'), name: "New Year's Day", region: null },
  {
    countryCode: 'US',
    holidayDate: new Date('2026-07-04'),
    name: 'Independence Day',
    region: null,
  },
  {
    countryCode: 'AE',
    holidayDate: new Date('2026-12-02'),
    name: 'UAE National Day',
    region: null,
  },
  {
    countryCode: 'SA',
    holidayDate: new Date('2026-09-23'),
    name: 'Saudi National Day',
    region: null,
  },
];

export function leaveDaysToMinutes(days: number): number {
  return days * MINUTES_PER_LEAVE_DAY;
}
