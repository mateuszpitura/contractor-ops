// Shared ME-region Gulf test fixtures.
//
// Plain-object factories (NO DB writes) for the C1-C10 Gulf test suite and the
// downstream service tests. Unit tests pass these to a mocked Prisma client;
// integration tests can seed them directly. Keeping them DB-free keeps the suite
// fast (analog: the inline fixture builders in
// packages/api/src/services/__tests__/compliance-payment-gate.test.ts).
//
// All enum-shaped string values are UPPER_SNAKE_CASE per the db:audit-enum-casing rule:
//   dataRegion 'ME', zone 'DMCC'/'MAINLAND', severity 'BLOCKING', status 'EXPIRED',
//   documentType 'UAE_FREE_ZONE_LICENSE'.
//
// These factories are typed structurally (not against the generated client) so tests
// can import them before a schema migration is applied. Downstream tests may tighten
// the return types to the generated Prisma row types once available.

/** A minimal ME-region organization row (UAE/KSA orgs route to the ME DB). */
export interface MeOrgFixture {
  id: string;
  name: string;
  dataRegion: 'ME';
  /** ISO-3166-1 alpha-2; 'AE' (UAE) or 'SA' (KSA). */
  countryCode: 'AE' | 'SA';
}

/** A free-zone assignment row (per-contractor). */
export interface FreeZoneAssignmentFixture {
  id: string;
  organizationId: string;
  contractorId: string;
  /** UaeFreeZoneCode enum value; 'MAINLAND' arms no payment-block gate. */
  zone: string;
  licenseNumber: string;
  licenseExpiresAt: Date;
  /** ISIC-style codes that drive the permitted-activity overlap check. */
  permittedActivityIsicCodes: string[];
  /** Human-readable permitted-activities text (display/audit). */
  permittedActivitiesText: string;
}

/** A free-zone ContractorComplianceItem row shaped for the cascade + payment gate. */
export interface FreeZoneComplianceItemFixture {
  id: string;
  organizationId: string;
  contractorId: string;
  contractId: string | null;
  documentType: 'UAE_FREE_ZONE_LICENSE';
  name: string;
  severity: 'BLOCKING';
  policyRuleId: 'uae.free_zone_license@v2';
  expiryJurisdictionTz: 'Asia/Dubai';
  expiresAt: Date;
  /** ComplianceStatus; the payment gate selects status='EXPIRED'. */
  status: string;
}

const DEFAULT_ORG_ID = 'clmeorgaaaaaaaaaaaaaaaaaaaa';
const DEFAULT_CONTRACTOR_ID = 'clmectraaaaaaaaaaaaaaaaaaaa';

/** ME-region org (UAE by default). UAE/KSA orgs live in the ME DB. */
export function makeMeOrg(overrides: Partial<MeOrgFixture> = {}): MeOrgFixture {
  return {
    id: DEFAULT_ORG_ID,
    name: 'Gulf Ops FZE',
    dataRegion: 'ME',
    countryCode: 'AE',
    ...overrides,
  };
}

/** Free-zone assignment; zone defaults to DMCC (a real free-zone, not Mainland). */
export function makeFreeZoneAssignment(
  overrides: Partial<FreeZoneAssignmentFixture> = {},
): FreeZoneAssignmentFixture {
  return {
    id: 'clmefzaaaaaaaaaaaaaaaaaaaaa',
    organizationId: DEFAULT_ORG_ID,
    contractorId: DEFAULT_CONTRACTOR_ID,
    zone: 'DMCC',
    licenseNumber: 'DMCC-12345',
    licenseExpiresAt: new Date('2026-12-31T00:00:00Z'),
    permittedActivityIsicCodes: ['6201', '6202'],
    permittedActivitiesText: 'Computer programming and consultancy activities',
    ...overrides,
  };
}

/**
 * Free-zone compliance item carrying exactly the columns the reminder cron and
 * payment gate select on (severity BLOCKING, policyRuleId @v2, expiresAt,
 * expiryJurisdictionTz). `status` is param-driven so a test can build an EXPIRED
 * (gate-blocking) or PENDING (cascade-only) row.
 */
export function makeFreeZoneComplianceItem(
  overrides: Partial<FreeZoneComplianceItemFixture> = {},
): FreeZoneComplianceItemFixture {
  return {
    id: 'clmefzitemaaaaaaaaaaaaaaaaa',
    organizationId: DEFAULT_ORG_ID,
    contractorId: DEFAULT_CONTRACTOR_ID,
    contractId: null,
    documentType: 'UAE_FREE_ZONE_LICENSE',
    name: 'UAE Free-Zone Trade License',
    severity: 'BLOCKING',
    policyRuleId: 'uae.free_zone_license@v2',
    expiryJurisdictionTz: 'Asia/Dubai',
    expiresAt: new Date('2026-04-01T00:00:00Z'),
    status: 'PENDING',
    ...overrides,
  };
}
