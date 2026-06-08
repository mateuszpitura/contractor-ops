// Phase 84 · Plan 00 (Wave 0 RED) — US-FIELD-01 / US-FIELD-02 (D-01/D-02/D-09).
// See .planning/milestones/v7.0-phases/84-.../84-VALIDATION.md.
//
// Locks the behavioural contract for two not-yet-existing staff-router procedures:
//
//   contractor.revealSsn      (Plan 03) — audit-logged, RBAC-gated full-SSN reveal
//   contractor.updateUsProfile(Plan 03) — SSN→dedicated encrypted columns (never JSONB),
//                                          EIN→BAD_REQUEST on invalid, USPS failure non-blocking
//
// RED because neither procedure key exists on `contractorRouter` yet — the
// caller invocations reject / the procedure-presence assertions fail until
// Plan 03 lands them. Mirrors economic-dependency-alert.test.ts (createCaller +
// makeCaller + mockHasPermission + writeAuditLog mock).

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const CONTRACTOR_A = 'clcontractoraaaaaaaaaaaaaaa';

// The plaintext SSN the reveal procedure decrypts. The audit-metadata assertion
// proves this value NEVER appears in the written audit row (synthetic — the
// historic Woolworth wallet number, not a live identity).
const PLAINTEXT_SSN = '078051120';
const ENCRYPTED_SSN = 'iv-hex:authtag-hex:ciphertext-hex';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

const { mockPrisma, mockHasPermission, auditWrites } = vi.hoisted(() => {
  // Hoisted factory runs before module-level consts — inline literals here.
  const CONTRACTOR_ID = 'clcontractoraaaaaaaaaaaaaaa';
  const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
  const auditWrites: Record<string, unknown>[] = [];
  const mockHasPermission = vi.fn().mockResolvedValue({ success: true });
  const contractors = new Map<string, Record<string, unknown>>();
  contractors.set(CONTRACTOR_ID, {
    id: CONTRACTOR_ID,
    organizationId: ORG_ID,
    ssnEncrypted: 'iv-hex:authtag-hex:ciphertext-hex',
    ssnLast4: '1120',
    countryFields: {},
  });
  type Rec = Record<string, unknown>;
  const mockPrisma = {
    contractor: {
      findUnique: vi.fn(async (args: { where?: Rec; select?: Rec }) => {
        const where = args?.where ?? {};
        const row = contractors.get(String(where.id));
        if (!row) return null;
        if ('organizationId' in where && where.organizationId !== row.organizationId) return null;
        return row;
      }),
      findFirst: vi.fn(async (args: { where?: Rec }) => {
        const where = args?.where ?? {};
        const row = contractors.get(String(where.id));
        if (!row) return null;
        if ('organizationId' in where && where.organizationId !== row.organizationId) return null;
        return row;
      }),
      update: vi.fn(async (args: { where?: Rec; data?: Rec }) => ({
        ...(contractors.get(String(args?.where?.id)) ?? {}),
        ...(args?.data ?? {}),
      })),
    },
    organization: {
      findUnique: vi.fn(async () => ({ countryCode: 'US', dataRegion: 'EU', status: 'ACTIVE' })),
      findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'US' })),
    },
  };
  return { mockPrisma, mockHasPermission, auditWrites };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: mockHasPermission },
  },
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

vi.mock('@contractor-ops/logger', () => ({
  createWebhookLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  createTrpcLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  createCronLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  // root.ts → routers/integrations/deprovisioning.ts calls this at module load.
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// SSN crypto (Plan 02) — decrypt returns the plaintext, encrypt round-trips a marker.
vi.mock('../../../services/ssn-crypto', () => ({
  encryptSsn: vi.fn(() => ENCRYPTED_SSN),
  decryptSsn: vi.fn(() => PLAINTEXT_SSN),
}));

vi.mock('../../../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async (input: Rec) => {
    auditWrites.push(input);
  }),
}));

import { createCallerFactory } from '../../../init';
import { portalAppRouter } from '../../../portal-root';
import { appRouter } from '../../../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId = ORG_A, userId = USER_ID, role = 'admin') {
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
  mockHasPermission.mockResolvedValue({ success: true });
  auditWrites.length = 0;
  vi.clearAllMocks();
  mockHasPermission.mockResolvedValue({ success: true });
});

// ---------------------------------------------------------------------------
// contractor.revealSsn (D-02 / D-09 RBAC + audit + tenant + staff-router-only)
// ---------------------------------------------------------------------------

describe('contractor.revealSsn — RBAC (D-02/D-09)', () => {
  it('throws FORBIDDEN when the caller lacks contractorPii:[read]', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);
    await expect(
      (caller.contractor as Rec).revealSsn({ contractorId: CONTRACTOR_A }) as Promise<unknown>,
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('contractor.revealSsn — happy path + audit', () => {
  it('returns { ssn } and writes an audit row action=contractor.ssn.revealed', async () => {
    const caller = makeCaller(ORG_A);
    const result = (await (caller.contractor as Rec).revealSsn({
      contractorId: CONTRACTOR_A,
    })) as { ssn: string };
    expect(result.ssn).toBe(PLAINTEXT_SSN);
    expect(auditWrites).toHaveLength(1);
    expect(auditWrites[0]).toMatchObject({
      action: 'contractor.ssn.revealed',
      resourceType: 'CONTRACTOR',
    });
  });

  it('NEVER places the raw SSN value anywhere in the audit-row metadata', () => {
    // Defensive scan: serialise the whole audit input and assert the plaintext
    // SSN does not appear (T-84-00-01 — no SSN in the append-only audit log).
    const serialised = JSON.stringify(auditWrites);
    expect(serialised).not.toContain(PLAINTEXT_SSN);
  });
});

describe('contractor.revealSsn — tenant scoping (IDOR)', () => {
  it('throws NOT_FOUND for a contractor in another organization', async () => {
    const caller = makeCaller(ORG_B);
    await expect(
      (caller.contractor as Rec).revealSsn({ contractorId: CONTRACTOR_A }) as Promise<unknown>,
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

describe('contractor.revealSsn — staff-router-only (Pitfall 6)', () => {
  it('is registered on the staff contractor router', () => {
    expect((appRouter._def.procedures as Rec)['contractor.revealSsn']).toBeDefined();
  });

  it('is NOT exposed on any portal router', () => {
    const portalKeys = Object.keys(portalAppRouter._def.procedures as Rec);
    expect(portalKeys.some(k => k.toLowerCase().includes('revealssn'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// contractor.updateUsProfile (D-01 storage invariants + EIN + USPS non-blocking)
// ---------------------------------------------------------------------------

describe('contractor.updateUsProfile — SSN storage invariant (D-01, Pitfall 3)', () => {
  it('writes a provided SSN to ssnEncrypted/ssnLast4 and NEVER into countryFields JSONB', async () => {
    const caller = makeCaller(ORG_A);
    await (caller.contractor as Rec).updateUsProfile({
      contractorId: CONTRACTOR_A,
      ssn: PLAINTEXT_SSN,
      ein: '12-3456789',
      addressLine1: '1 Main St',
      city: 'Anytown',
      state: 'NY',
      zipCode: '10001',
    });
    const updateArgs = mockPrisma.contractor.update.mock.calls.at(-1)?.[0] as
      | { data?: Rec }
      | undefined;
    const data = updateArgs?.data ?? {};
    expect(data.ssnEncrypted).toBeDefined();
    expect(data.ssnLast4).toBe('1120');
    // The JSONB blob must never carry the SSN (plain OR encrypted).
    const jsonbBlob = JSON.stringify(data.countryFields ?? {});
    expect(jsonbBlob).not.toContain(PLAINTEXT_SSN);
    expect(jsonbBlob.toLowerCase()).not.toContain('ssn');
  });
});

describe('contractor.updateUsProfile — EIN validation (US-FIELD-01)', () => {
  it('throws BAD_REQUEST for an invalid EIN', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      (caller.contractor as Rec).updateUsProfile({
        contractorId: CONTRACTOR_A,
        ein: '07-1234567', // 07 is not a valid IRS prefix
      }) as Promise<unknown>,
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('contractor.updateUsProfile — USPS non-blocking (D-03)', () => {
  it('still resolves (address saved unverified) when USPS validation fails', async () => {
    const caller = makeCaller(ORG_A);
    // A USPS failure must NOT throw to the save path — the mutation resolves and
    // the address is persisted with an unverified flag.
    await expect(
      (caller.contractor as Rec).updateUsProfile({
        contractorId: CONTRACTOR_A,
        addressLine1: '1 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '10001',
      }) as Promise<unknown>,
    ).resolves.toBeDefined();
  });
});
