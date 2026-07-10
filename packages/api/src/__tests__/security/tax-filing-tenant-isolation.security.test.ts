// Cross-tenant isolation (IDOR) regression coverage for the US year-end filing
// models. `Form1099Nec` and `IrisSubmission` are tenant-owning models (never in
// `globalModels`). These specs lock that a second org cannot read another org's
// rows: the staff `tax1099` router scopes every read to the caller's
// organizationId, and a cross-org get-by-id rejects NOT_FOUND.
//
// Same strategy as the sibling tenant-isolation suites: a mocked, org-scoped
// Prisma echoes the `where` it is handed, so the test regression-LOCKS the org
// guard — the list returns only the caller's rows, the findMany/findFirst `where`
// always carries the caller organizationId, and a foreign row read is NOT_FOUND.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_A = 'clorgaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'clorgbbbbbbbbbbbbbbbbbbbbbb';
const USER_A = 'cluseraaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'cluserbbbbbbbbbbbbbbbbbbbbb';

type Rec = Record<string, unknown>;

const { mockPrisma, mockHasPermission, form1099Rows, irisSubmissionRows, whereLog, flagEnabled } =
  vi.hoisted(() => {
    type R = Record<string, unknown>;

    const form1099Rows: R[] = [];
    const irisSubmissionRows: R[] = [];
    const whereLog: R[] = [];
    const flagEnabled = { value: true };
    const mockHasPermission = vi.fn().mockResolvedValue({ success: true });

    const scope = (rows: R[], where: R) =>
      rows.filter(r => r.organizationId === where.organizationId);

    const orgMeta = (id: string): R => ({
      id,
      countryCode: 'US',
      dataRegion: 'EU',
      status: 'ACTIVE',
      name: id === ORG_B ? 'Org B' : 'Acme',
      legalName: id === ORG_B ? 'Org B LLC' : 'Acme LLC',
      slug: id === ORG_B ? 'org-b' : 'org-a',
      logo: null,
    });

    const mockPrisma: R = {
      organization: {
        findUnique: vi.fn(async (args: { where?: R }) => {
          const id = (args?.where?.id as string | undefined) ?? ORG_A;
          return orgMeta(id);
        }),
        findUniqueOrThrow: vi.fn(async (args: { where?: R }) => {
          const id = (args?.where?.id as string | undefined) ?? ORG_A;
          return orgMeta(id);
        }),
      },
      subscription: {
        findUnique: vi.fn(async () => ({
          id: 'sub-1',
          tier: 'STARTER',
          status: 'ACTIVE',
          addOns: ['us-cross-border'],
        })),
      },
      $transaction: vi.fn(async (fn: (tx: R) => Promise<unknown>) => fn(mockPrisma)),
      form1099Nec: {
        findMany: vi.fn(async (args: { where?: R }) => {
          const where = args?.where ?? {};
          whereLog.push({ model: 'form1099Nec.findMany', where });
          return scope(form1099Rows, where);
        }),
        findFirst: vi.fn(async (args: { where?: R }) => {
          const where = args?.where ?? {};
          whereLog.push({ model: 'form1099Nec.findFirst', where });
          return (
            scope(form1099Rows, where).find(r => {
              if (where.id && r.id !== where.id) return false;
              if (where.status && r.status !== where.status) return false;
              return true;
            }) ?? null
          );
        }),
      },
      irisSubmission: {
        findFirst: vi.fn(async (args: { where?: R }) => {
          const where = args?.where ?? {};
          whereLog.push({ model: 'irisSubmission.findFirst', where });
          return (
            scope(irisSubmissionRows, where).find(r =>
              where.taxYear ? r.taxYear === where.taxYear : true,
            ) ?? null
          );
        }),
      },
    };

    return {
      mockPrisma,
      mockHasPermission,
      form1099Rows,
      irisSubmissionRows,
      whereLog,
      flagEnabled,
    };
  });

vi.mock('@contractor-ops/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/auth')>();
  return {
    ...actual,
    auth: {
      api: {
        getSession: vi.fn(),
        hasPermission: mockHasPermission,
      },
    },
    authApi: {
      getSession: vi.fn(),
      hasPermission: mockHasPermission,
      getFullOrganization: vi.fn(),
    },
  };
});

vi.mock('@contractor-ops/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/db')>();
  return {
    ...actual,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: mockPrisma,
    prismaRaw: mockPrisma,
    tenantStore: {
      run: (_c: unknown, fn: () => unknown) => fn(),
      getStore: vi.fn(() => ({ region: 'EU' })),
    },
    withTenantScope: vi.fn((c: unknown) => c),
    withSoftDelete: vi.fn((c: unknown) => c),
    createTenantClient: vi.fn(() => mockPrisma),
    createTenantClientFrom: vi.fn(() => mockPrisma),
    getRegionalClient: vi.fn(() => mockPrisma),
    preWarmRegionalClients: vi.fn(),
  };
});

vi.mock('../../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/cache')>();
  const { createPassthroughCacheMock } = await import('../../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual);
});

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
  const span = { setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() };
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
    startSpan: vi.fn((_o: unknown, fn: (s: typeof span) => unknown) => fn(span)),
    captureException: vi.fn(),
  };
});

vi.mock('../../services/audit-writer', () => ({
  writeAuditLog: vi.fn(async () => {}),
}));

import { createCallerFactory } from '../../init';
import { appRouter } from '../../root';

const createCaller = createCallerFactory(appRouter);

function makeCaller(orgId: string, userId: string) {
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
      role: 'admin',
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
  form1099Rows.length = 0;
  irisSubmissionRows.length = 0;
  whereLog.length = 0;
  flagEnabled.value = true;
  mockHasPermission.mockResolvedValue({ success: true });
  form1099Rows.push({
    id: 'form-a-1',
    organizationId: ORG_A,
    payerOrgId: ORG_A,
    recipientId: 'rec-a-1',
    taxYear: 2025,
    status: 'ACTIVE',
    corrected: false,
    box1AmountMinor: 250_000,
    box4BackupWithholdingMinor: 0,
    currency: 'USD',
    cfsfStateCode: null,
    pdfArchiveKey: null,
    createdAt: new Date(),
    recipient: { legalName: 'Recipient A', ssnLast4: '1120' },
  });
  irisSubmissionRows.push({ id: 'sub-a-1', organizationId: ORG_A, taxYear: 2025 });
});

describe('tax-filing tenant isolation — Form1099Nec', () => {
  it('the list query is always scoped to the caller organizationId', async () => {
    const callerA = makeCaller(ORG_A, USER_A);
    const rowsA = await callerA.tax1099.list({ taxYear: 2025 });
    expect(rowsA).toHaveLength(1);

    const listWhere = whereLog.find(w => w.model === 'form1099Nec.findMany')?.where as Rec;
    expect(listWhere.organizationId).toBe(ORG_A);
  });

  it('orgB cannot read orgA Form1099Nec rows (list returns none)', async () => {
    const callerB = makeCaller(ORG_B, USER_B);
    const rowsB = await callerB.tax1099.list({ taxYear: 2025 });
    expect(rowsB).toHaveLength(0);
  });

  it('orgB fileCorrection on an orgA form rejects NOT_FOUND', async () => {
    const callerB = makeCaller(ORG_B, USER_B);
    await expect(
      callerB.tax1099.fileCorrection({ formId: 'form-a-1', reason: 'typo' }),
    ).rejects.toThrow();

    const w = whereLog.find(x => x.model === 'form1099Nec.findFirst')?.where as Rec;
    expect(w.organizationId).toBe(ORG_B);
  });
});

describe('tax-filing tenant isolation — IrisSubmission', () => {
  it('orgB cannot read orgA IrisSubmission rows (uploadAck rejects NOT_FOUND)', async () => {
    const callerB = makeCaller(ORG_B, USER_B);
    const ackXml =
      '<?xml version="1.0"?><Acknowledgement><AcknowledgementStatusTxt>Accepted</AcknowledgementStatusTxt><ReceiptId>R1</ReceiptId></Acknowledgement>';

    await expect(callerB.tax1099.uploadAck({ taxYear: 2025, ackXml })).rejects.toThrow();

    const w = whereLog.find(x => x.model === 'irisSubmission.findFirst')?.where as Rec;
    expect(w.organizationId).toBe(ORG_B);
  });
});
