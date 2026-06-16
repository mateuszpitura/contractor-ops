// Staff US W-form read/track integration tests.
// Owns: pnpm --filter @contractor-ops/api test src/routers/core/__tests__/tax-form-staff.test.ts
//
// Proves the staff-side invariants of the read/track surface:
//   - listFormSubmissions returns status/track WITHOUT a full SSN (the snapshot
//     JSON is never projected; only structured status columns are selected).
//   - The full-SSN reveal path is NOT on the tax-form router — it stays on the
//     existing contractor.revealSsn (contractorPii:read), which is audited.
//   - requestTaxForm writes a USER audit row and never creates a signed record
//     (staff cannot self-certify on a contractor's behalf).
//   - The staff surface is gated behind module.us-expansion (per-request guard).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';
const OTHER_ORG_ID = 'clorgbbbbbbbbbbbbbbbbbbbbbb';

// A synthetic SSN (the historic Woolworth wallet number, not a live identity).
// Asserted to never appear in any staff list-submissions projection.
const FULL_SSN = '078051120';

type Rec = Record<string, unknown>;

const { mockPrisma, mockHasPermission, taxFormRows, auditWrites, flagEnabled } = vi.hoisted(() => {
  // Hoisted factory runs before module-level consts — inline literals here.
  const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
  const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';
  type Rec = Record<string, unknown>;

  const taxFormRows: Record<string, unknown>[] = [];
  const auditWrites: Record<string, unknown>[] = [];
  const flagEnabled = { value: true };
  const mockHasPermission = vi.fn().mockResolvedValue({ success: true });

  const taxFormSubmission = {
    findMany: vi.fn(async (args: { where?: Rec; select?: Rec }) => {
      const where = args?.where ?? {};
      const rows = taxFormRows.filter(
        r =>
          r.organizationId === where.organizationId &&
          (where.contractorId ? r.contractorId === where.contractorId : true),
      );
      // Honour the select projection so the test sees exactly what the procedure
      // returns — a full snapshot is only leaked if the procedure selects it.
      const select = args?.select;
      if (!select) return rows;
      return rows.map(r => {
        const out: Rec = {};
        for (const key of Object.keys(select)) {
          if (select[key]) out[key] = r[key];
        }
        return out;
      });
    }),
  };

  const mockPrisma: Rec = {
    contractor: {
      findUnique: vi.fn(async (args: { where?: Rec }) => {
        const where = args?.where ?? {};
        if (where.id !== CONTRACTOR_ID) return null;
        if ('organizationId' in where && where.organizationId !== ORG_ID) return null;
        return { id: CONTRACTOR_ID };
      }),
    },
    organization: {
      findUnique: vi.fn(async () => ({ countryCode: 'US', dataRegion: 'EU', status: 'ACTIVE' })),
      findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'US' })),
    },
    taxFormSubmission,
  };

  return { mockPrisma, mockHasPermission, taxFormRows, auditWrites, flagEnabled };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: { api: { getSession: vi.fn(), hasPermission: mockHasPermission } },
  authApi: { hasPermission: mockHasPermission },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
  prismaRaw: mockPrisma,
  tenantStore: {
    run: (_ctx: unknown, fn: () => unknown) => fn(),
    getStore: vi.fn(() => ({ region: 'EU' })),
  },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
  getRegionalClient: vi.fn(() => mockPrisma),
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: flagEnabled.value, reason: 'unleash' })),
  buildFlagBag: vi.fn(() => ({ isEnabled: () => flagEnabled.value })),
}));

vi.mock('@contractor-ops/logger', () => ({
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  withBodyLogging: vi.fn((_o, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_c, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { increment: vi.fn(), histogram: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@sentry/node', () => {
  const mockSpan = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
  return {
    getCurrentScope: vi.fn(() => ({
      setUser: vi.fn(),
      setTag: vi.fn(),
      setTags: vi.fn(),
      setContext: vi.fn(),
      setExtra: vi.fn(),
      clear: vi.fn(),
    })),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
    setContext: vi.fn(),
    startSpan: vi.fn((_o: unknown, fn: (span: typeof mockSpan) => unknown) => fn(mockSpan)),
    captureException: vi.fn(),
  };
});

vi.mock('../../../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async (input: Rec) => {
    auditWrites.push(input);
  }),
}));

import { createCallerFactory } from '../../../init';
import { portalAppRouter } from '../../../portal-root';
import { appRouter } from '../../../root';

const createCaller = createCallerFactory(appRouter);

function makeStaffCaller(orgId = ORG_ID, userId = USER_ID, role = 'admin') {
  const session = {
    session: {
      id: `session-${userId}`,
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date('2099-01-01'),
      token: 'mock-token',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      banned: false,
      banReason: null,
      banExpires: null,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
  return createCaller({
    headers: new Headers(),
    session: session as never,
    user: session.user as never,
  });
}

beforeEach(() => {
  taxFormRows.length = 0;
  auditWrites.length = 0;
  flagEnabled.value = true;
  mockHasPermission.mockResolvedValue({ success: true });
  vi.clearAllMocks();
  mockHasPermission.mockResolvedValue({ success: true });
});

// ---------------------------------------------------------------------------
// taxForm.listFormSubmissions — status/track without full SSN
// ---------------------------------------------------------------------------

describe('taxForm.listFormSubmissions — status/track without PII (US-FORM-01)', () => {
  it('returns the status columns and never projects the snapshot / full SSN', async () => {
    // The stored row carries a snapshot with only the last-4 (the production
    // service never writes a full SSN); the list projection must not select it.
    taxFormRows.push({
      id: 'taxform-1',
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      formType: 'W9',
      status: 'ACTIVE',
      treatyArticle: null,
      treatyRate: null,
      contractorResidency: null,
      signerName: 'Jane Q. Contractor',
      signedAt: new Date('2026-06-16T12:00:00.000Z'),
      expiresAt: null,
      createdAt: new Date('2026-06-16T12:00:00.000Z'),
      // Even if a snapshot is on the row, the projection must exclude it.
      snapshotJson: { fields: { tin: { ssn: FULL_SSN } } },
    });

    const caller = makeStaffCaller();
    const rows = (await (caller.taxForm as Rec).listFormSubmissions({})) as Rec[];

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'taxform-1', formType: 'W9', status: 'ACTIVE' });
    // The snapshot column is never selected — no full SSN can leak through it.
    expect(rows[0].snapshotJson).toBeUndefined();
    expect(JSON.stringify(rows)).not.toContain(FULL_SSN);
  });

  it('scopes to the staff tenant org and optional contractor (no cross-tenant leak)', async () => {
    taxFormRows.push({
      id: 'mine',
      organizationId: ORG_ID,
      contractorId: CONTRACTOR_ID,
      formType: 'W9',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    taxFormRows.push({
      id: 'foreign-org',
      organizationId: OTHER_ORG_ID,
      contractorId: CONTRACTOR_ID,
      formType: 'W9',
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    const caller = makeStaffCaller();
    const rows = (await (caller.taxForm as Rec).listFormSubmissions({})) as Rec[];
    expect(rows.every(r => r.id !== 'foreign-org')).toBe(true);
    expect(rows.some(r => r.id === 'mine')).toBe(true);
  });

  it('throws FORBIDDEN when the caller lacks contractor:[read]', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeStaffCaller();
    await expect(
      (caller.taxForm as Rec).listFormSubmissions({}) as Promise<unknown>,
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ---------------------------------------------------------------------------
// taxForm.requestTaxForm — auditable request, no signed record
// ---------------------------------------------------------------------------

describe('taxForm.requestTaxForm — audited request, no on-behalf signing (US-FORM-01)', () => {
  it('writes a USER audit row and never creates a signed record', async () => {
    const caller = makeStaffCaller();
    const result = (await (caller.taxForm as Rec).requestTaxForm({
      contractorId: CONTRACTOR_ID,
      formType: 'W8BEN',
    })) as Rec;

    expect(result).toMatchObject({
      contractorId: CONTRACTOR_ID,
      formType: 'W8BEN',
      requested: true,
    });
    expect(auditWrites).toHaveLength(1);
    expect(auditWrites[0]).toMatchObject({
      action: 'tax.form.requested',
      actorType: 'USER',
      actorId: USER_ID,
      resourceType: 'CONTRACTOR',
    });
    // Staff cannot self-certify: no ACTIVE/DRAFT submission row is created.
    expect(taxFormRows).toHaveLength(0);
  });

  it('throws NOT_FOUND for a contractor outside the staff tenant org', async () => {
    const caller = makeStaffCaller(OTHER_ORG_ID);
    await expect(
      (caller.taxForm as Rec).requestTaxForm({
        contractorId: CONTRACTOR_ID,
        formType: 'W9',
      }) as Promise<unknown>,
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// Full-SSN reveal stays off the tax-form router (RBAC boundary)
// ---------------------------------------------------------------------------

describe('staff full-SSN reveal — gated on contractor.revealSsn, not taxForm', () => {
  it('does not expose any reveal-ssn procedure on the taxForm namespace', () => {
    const keys = Object.keys(appRouter._def.procedures as Rec).filter(k =>
      k.startsWith('taxForm.'),
    );
    expect(keys.some(k => k.toLowerCase().includes('ssn'))).toBe(false);
    expect(keys.some(k => k.toLowerCase().includes('reveal'))).toBe(false);
  });

  it('keeps contractor.revealSsn (contractorPii:read) as the only full-SSN path', () => {
    expect((appRouter._def.procedures as Rec)['contractor.revealSsn']).toBeDefined();
    const portalKeys = Object.keys(portalAppRouter._def.procedures as Rec);
    expect(portalKeys.some(k => k.toLowerCase().includes('revealssn'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Flag gating
// ---------------------------------------------------------------------------

describe('staff tax-form surface — module.us-expansion gating (US-FORM-01)', () => {
  it('throws FORBIDDEN on the staff procedures when the flag is off', async () => {
    flagEnabled.value = false;
    const caller = makeStaffCaller();
    await expect(
      (caller.taxForm as Rec).listFormSubmissions({}) as Promise<unknown>,
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
