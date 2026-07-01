// Locks the behavioural contract for the workforce employee registry,
// composed onto the staff `employee.*` namespace:
//
//   employee.register   — per-market validation, national-IDs → dedicated
//                          encrypted columns (never JSONB, never on the return),
//                          Emirates-ID checksum advisory-only, audit-logged
//   employee.revealPii   — audit-logged, RBAC-gated (employeePii:read) full
//                          national-ID reveal, field-routed decrypt, staff-only

import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';
const USER_ID = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const WORKER_A = 'clworkeraaaaaaaaaaaaaaaaaaa';

// Synthetic identifiers — never live identities. PESEL is a documented canonical
// test vector; the SSN is the historic Woolworth wallet number.
const VALID_PESEL = '44051401359';
const PLAINTEXT_SSN = '078051120';
const ENCRYPTED_MARKER = 'iv-hex:authtag-hex:ciphertext-hex';
// Format-valid Emirates ID whose advisory Luhn-variant checksum fails.
const ADVISORY_EMIRATES_ID = '784-1990-1234567-1';

type Rec = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockHasPermission, auditWrites } = vi.hoisted(() => {
  const ORG_ID = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
  const WORKER_ID = 'clworkeraaaaaaaaaaaaaaaaaaa';
  const auditWrites: Record<string, unknown>[] = [];
  const mockHasPermission = vi.fn().mockResolvedValue({ success: true });

  type R = Record<string, unknown>;
  const profiles = new Map<string, R>();
  profiles.set(WORKER_ID, {
    id: 'clempprofileaaaaaaaaaaaaaaa',
    organizationId: ORG_ID,
    workerId: WORKER_ID,
    countryCode: 'US',
    ssnEncrypted: 'iv-hex:authtag-hex:ciphertext-hex',
    ssnLast4: '1120',
    peselEncrypted: null,
    iqamaEncrypted: null,
    emiratesIdEncrypted: null,
  });

  const employeeProfile = {
    findUnique: vi.fn(async (args: { where?: R; select?: R }) => {
      const where = args?.where ?? {};
      const row = profiles.get(String(where.workerId));
      if (!row) return null;
      if ('organizationId' in where && where.organizationId !== row.organizationId) return null;
      return row;
    }),
    create: vi.fn(async (args: { data?: R; omit?: R }) => {
      const data = args?.data ?? {};
      const row: R = { id: 'clempprofilenewaaaaaaaaaaaa', ...data };
      // Simulate Prisma `omit`: strip the omitted columns from the return shape.
      for (const [key, drop] of Object.entries(args?.omit ?? {})) {
        if (drop) delete row[key];
      }
      return row;
    }),
  };

  const worker = {
    create: vi.fn(async (_args: { data?: R }) => ({ id: 'clworkernewaaaaaaaaaaaaaaaa' })),
  };

  const mockPrisma = {
    employeeProfile,
    worker,
    organization: {
      findUnique: vi.fn(async () => ({ countryCode: 'US', dataRegion: 'EU', status: 'ACTIVE' })),
      findUniqueOrThrow: vi.fn(async () => ({ countryCode: 'US' })),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockPrisma)),
  };

  return { mockPrisma, mockHasPermission, auditWrites };
});

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: { getSession: vi.fn(), hasPermission: mockHasPermission },
  },
  authApi: { hasPermission: mockHasPermission },
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: true, reason: 'unleash' })),
  buildFlagBag: vi.fn(() => ({ isEnabled: () => true })),
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
  getIdpAuditLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../services/ssn-crypto', () => ({
  encryptSsn: vi.fn(() => ENCRYPTED_MARKER),
  decryptSsn: vi.fn(() => PLAINTEXT_SSN),
  maskSsnLast4: vi.fn((v: string) => v.replace(/\D/g, '').slice(-4)),
}));

vi.mock('../services/employee-pii-crypto', () => ({
  encryptPii: vi.fn(() => ENCRYPTED_MARKER),
  decryptPii: vi.fn(() => 'decrypted-pii'),
  maskLast4: vi.fn((v: string) => v.replace(/\D/g, '').slice(-4)),
}));

vi.mock('../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async (input: Rec) => {
    auditWrites.push(input);
  }),
}));

import { createCallerFactory } from '../init';
import { portalAppRouter } from '../portal-root';
import { appRouter } from '../root';

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
  vi.clearAllMocks();
  auditWrites.length = 0;
  mockHasPermission.mockResolvedValue({ success: true });
});

// ---------------------------------------------------------------------------
// employee.register — encrypted-column omit + storage invariants
// ---------------------------------------------------------------------------

describe('employee.register — encrypted-column omit', () => {
  it('omits every *Encrypted column from the registration response', async () => {
    const caller = makeCaller(ORG_A);
    const result = (await (caller.employee as Rec).register({
      displayName: 'Jan Kowalski',
      countryCode: 'PL',
      countryFields: { stanowisko: 'Programista' },
      pesel: VALID_PESEL,
    })) as Rec;

    const keys = Object.keys(result);
    expect(keys.some(k => k.endsWith('Encrypted'))).toBe(false);
    // The masked last-4 is allowed to round-trip for default display.
    expect(result.peselLast4).toBe(VALID_PESEL.slice(-4));
    // The PESEL is encrypted into the dedicated column, never the JSON blob.
    const createArgs = mockPrisma.employeeProfile.create.mock.calls.at(-1)?.[0] as
      | { data?: Rec }
      | undefined;
    const data = createArgs?.data ?? {};
    expect(data.peselEncrypted).toBeDefined();
    const jsonbBlob = JSON.stringify(data.countryFields ?? {});
    expect(jsonbBlob.toLowerCase()).not.toContain('pesel');
    expect(jsonbBlob).not.toContain(VALID_PESEL);
  });

  it('writes an employee.registered audit row', async () => {
    const caller = makeCaller(ORG_A);
    await (caller.employee as Rec).register({
      displayName: 'Jan Kowalski',
      countryCode: 'PL',
      countryFields: { stanowisko: 'Programista' },
      pesel: VALID_PESEL,
    });
    expect(auditWrites).toHaveLength(1);
    expect(auditWrites[0]).toMatchObject({ action: 'employee.registered' });
  });
});

describe('employee.register — strict input (mass-assignment)', () => {
  it('rejects a client-set encrypted/last4 column via the strict schema', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      (caller.employee as Rec).register({
        displayName: 'Jan Kowalski',
        countryCode: 'PL',
        countryFields: { stanowisko: 'Programista' },
        ssnEncrypted: 'attacker-controlled',
      }) as Promise<unknown>,
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a structurally invalid PESEL with BAD_REQUEST', async () => {
    const caller = makeCaller(ORG_A);
    await expect(
      (caller.employee as Rec).register({
        displayName: 'Jan Kowalski',
        countryCode: 'PL',
        countryFields: { stanowisko: 'Programista' },
        pesel: '12345678901',
      }) as Promise<unknown>,
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('employee.register — Emirates-ID checksum advisory (never blocks)', () => {
  it('registers a format-valid Emirates ID with a failing Luhn and returns checksumAdvisory', async () => {
    const caller = makeCaller(ORG_A);
    const result = (await (caller.employee as Rec).register({
      displayName: 'Ahmed Ali',
      countryCode: 'AE',
      countryFields: { visaType: 'EMPLOYMENT' },
      emiratesId: ADVISORY_EMIRATES_ID,
    })) as Rec;
    expect(result.checksumAdvisory).toBeDefined();
    expect(Object.keys(result).some(k => k.endsWith('Encrypted'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// employee.revealPii — RBAC + audit + field routing + staff-only
// ---------------------------------------------------------------------------

describe('employee.revealPii — RBAC', () => {
  it('throws FORBIDDEN when the caller lacks employeePii:[read]', async () => {
    mockHasPermission.mockResolvedValue({ success: false });
    const caller = makeCaller(ORG_A);
    await expect(
      (caller.employee as Rec).revealPii({ workerId: WORKER_A, field: 'ssn' }) as Promise<unknown>,
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('employee.revealPii — happy path + audit', () => {
  it('returns the decrypted value and writes an employee.ssn.revealed audit row', async () => {
    const caller = makeCaller(ORG_A);
    const result = (await (caller.employee as Rec).revealPii({
      workerId: WORKER_A,
      field: 'ssn',
    })) as { field: string; value: string };
    expect(result.value).toBe(PLAINTEXT_SSN);
    expect(auditWrites).toHaveLength(1);
    expect(auditWrites[0]).toMatchObject({
      action: 'employee.ssn.revealed',
      metadata: { field: 'ssn' },
    });
  });

  it('NEVER places the raw national-ID value in the audit-row metadata', async () => {
    const caller = makeCaller(ORG_A);
    await (caller.employee as Rec).revealPii({ workerId: WORKER_A, field: 'ssn' });
    expect(JSON.stringify(auditWrites)).not.toContain(PLAINTEXT_SSN);
  });
});

describe('employee.revealPii — tenant scoping (IDOR)', () => {
  it('throws NOT_FOUND for an employee in another organization', async () => {
    const caller = makeCaller(ORG_B);
    await expect(
      (caller.employee as Rec).revealPii({ workerId: WORKER_A, field: 'ssn' }) as Promise<unknown>,
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

describe('employee.revealPii — staff-router-only', () => {
  it('is registered on the staff employee router', () => {
    expect((appRouter._def.procedures as Rec)['employee.revealPii']).toBeDefined();
  });

  it('is NOT exposed on any portal router', () => {
    const portalKeys = Object.keys(portalAppRouter._def.procedures as Rec);
    expect(portalKeys.some(k => k.toLowerCase().includes('revealpii'))).toBe(false);
  });
});
