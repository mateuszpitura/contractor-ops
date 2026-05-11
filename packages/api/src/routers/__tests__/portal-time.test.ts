/**
 * Portal time router — contractor-scoped timesheet flows (portalProcedure).
 * Mocks portal session, Prisma, and time/sync services.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-portal-time-001';
const CONTRACTOR_ID = 'contractor-portal-time-001';
const SESSION_TOKEN = 'portal-session-token-time';
const TS_ID = 'cltimesheet000000000000001';
const CONTRACT_ID = 'clcontract000000000000001';

const {
  mockPrisma,
  mockGetOrCreateTimesheet,
  mockSaveDraftEntries,
  mockSubmitTimesheet,
  mockSyncClockify,
  mockSyncJira,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, unknown>;

  const mockGetOrCreateTimesheet = vi.fn(async () => ({
    id: TS_ID,
    weekStartDate: new Date('2026-04-06T00:00:00.000Z'),
    organizationId: ORG_ID,
    contractorId: CONTRACTOR_ID,
    status: 'DRAFT',
    totalMinutes: 0,
  }));

  const mockSaveDraftEntries = vi.fn(async () => ({ updated: 1 }));
  const mockSubmitTimesheet = vi.fn(async () => ({ status: 'SUBMITTED' }));
  const mockSyncClockify = vi.fn(async () => ({ imported: 2 }));
  const mockSyncJira = vi.fn(async () => ({ imported: 1 }));

  const mockPrisma: Rec = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-mock', dataRegion: 'EU', status: 'ACTIVE' }),
    },
    timeEntry: {
      findMany: vi.fn(async () => []),
    },
    contract: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
    },
    timesheet: {
      findMany: vi.fn(async () => []),
    },
    integrationConnection: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
  };

  return {
    mockPrisma,
    mockGetOrCreateTimesheet,
    mockSaveDraftEntries,
    mockSubmitTimesheet,
    mockSyncClockify,
    mockSyncJira,
  };
});

vi.mock('../../services/time-entry', () => ({
  getOrCreateTimesheet: mockGetOrCreateTimesheet,
  saveDraftEntries: mockSaveDraftEntries,
  submitTimesheet: mockSubmitTimesheet,
}));

vi.mock('../../services/clockify-sync', () => ({
  syncClockifyEntries: mockSyncClockify,
}));

vi.mock('../../services/jira-worklog-sync', () => ({
  syncJiraWorklogs: mockSyncJira,
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
  authApi: {
    hasPermission: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
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

vi.mock('../../services/portal-session', () => ({
  validatePortalSession: vi.fn(async (token: string) => {
    if (token !== SESSION_TOKEN) return null;
    return {
      contractorId: CONTRACTOR_ID,
      organizationId: ORG_ID,
      contractor: { id: CONTRACTOR_ID, email: 'contractor@test.com' },
    };
  }),
  createPortalSession: vi.fn(),
  deletePortalSession: vi.fn(),
}));

vi.mock('@contractor-ops/logger', () => ({
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

vi.mock('@sentry/nextjs', () => {
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

import { createCallerFactory } from '../../init';
import { portalTimeRouter } from '../portal/portal-time';

const createCaller = createCallerFactory(portalTimeRouter);

function makePortalCaller() {
  return createCaller({
    headers: new Headers({ cookie: `portal_session=${SESSION_TOKEN}` }),
    session: null as never,
    user: null as never,
  });
}

const caller = makePortalCaller();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('portalTimeRouter', () => {
  it('getTimesheet loads entries scoped to org and timesheet', async () => {
    mockPrisma.timeEntry.findMany.mockResolvedValueOnce([
      {
        id: 'e1',
        timesheetId: TS_ID,
        organizationId: ORG_ID,
        contract: { id: CONTRACT_ID, title: 'MSA' },
      },
    ]);

    const out = await caller.getTimesheet({ weekStartDate: '2026-04-06' });

    expect(mockGetOrCreateTimesheet).toHaveBeenCalledWith(
      mockPrisma,
      ORG_ID,
      CONTRACTOR_ID,
      expect.any(Date),
    );
    expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          timesheetId: TS_ID,
          organizationId: ORG_ID,
        }),
      }),
    );
    expect(out.entries).toHaveLength(1);
  });

  it('getActiveContracts lists ACTIVE contracts for contractor', async () => {
    mockPrisma.contract.findMany.mockResolvedValueOnce([
      { id: CONTRACT_ID, title: 'MSA', rateType: 'HOURLY', rateValueMinor: 10000 },
    ]);

    const rows = await caller.getActiveContracts();

    expect(mockPrisma.contract.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        contractorId: CONTRACTOR_ID,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        rateType: true,
        rateValueMinor: true,
      },
      orderBy: { title: 'asc' },
    });
    expect(rows).toHaveLength(1);
  });

  it('saveDraftEntries delegates to service', async () => {
    await caller.saveDraftEntries({
      timesheetId: TS_ID,
      entries: [
        {
          contractId: CONTRACT_ID,
          entryDate: '2026-04-08',
          minutes: 60,
        },
      ],
    });

    expect(mockSaveDraftEntries).toHaveBeenCalledWith(
      mockPrisma,
      ORG_ID,
      CONTRACTOR_ID,
      TS_ID,
      expect.any(Array),
    );
  });

  it('submitTimesheet delegates to service', async () => {
    await caller.submitTimesheet({ timesheetId: TS_ID });

    expect(mockSubmitTimesheet).toHaveBeenCalledWith(mockPrisma, ORG_ID, CONTRACTOR_ID, TS_ID);
  });

  it('listTimesheets paginates with cursor and filters', async () => {
    mockPrisma.timesheet.findMany.mockResolvedValueOnce([
      {
        id: 't1',
        weekStartDate: new Date('2026-04-06'),
        status: 'DRAFT',
        totalMinutes: 0,
        submittedAt: null,
        reviewedAt: null,
      },
    ]);

    const out = await caller.listTimesheets({
      status: 'DRAFT',
      from: '2026-01-01',
      to: '2026-12-31',
      limit: 5,
    });

    expect(mockPrisma.timesheet.findMany).toHaveBeenCalled();
    expect(out.items).toHaveLength(1);
    expect(out.nextCursor).toBeUndefined();
  });

  it('getConnectedProviders maps Clockify and Jira connections', async () => {
    mockPrisma.integrationConnection.findMany.mockResolvedValueOnce([
      { provider: 'CLOCKIFY' },
      { provider: 'JIRA' },
    ]);

    const rows = await caller.getConnectedProviders();

    expect(rows.map(r => r.provider)).toEqual(['CLOCKIFY', 'JIRA']);
    expect(rows[0]?.displayName).toBe('Clockify');
    expect(rows[1]?.displayName).toBe('Jira');
  });

  it('syncExternal throws NOT_FOUND when integration is missing', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.syncExternal({
        provider: 'CLOCKIFY',
        startDate: '2026-04-01',
        endDate: '2026-04-07',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mockSyncClockify).not.toHaveBeenCalled();
  });

  it('syncExternal throws PRECONDITION_FAILED when no active contract', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({ id: 'int-1' });
    mockPrisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(
      caller.syncExternal({
        provider: 'CLOCKIFY',
        startDate: '2026-04-01',
        endDate: '2026-04-07',
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('syncExternal routes CLOCKIFY to syncClockifyEntries', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({ id: 'int-1' });
    mockPrisma.contract.findFirst.mockResolvedValueOnce({ id: CONTRACT_ID });

    await caller.syncExternal({
      provider: 'CLOCKIFY',
      startDate: '2026-04-01',
      endDate: '2026-04-07',
    });

    expect(mockSyncClockify).toHaveBeenCalledWith(
      mockPrisma,
      ORG_ID,
      CONTRACTOR_ID,
      CONTRACT_ID,
      TS_ID,
      'int-1',
      '2026-04-01',
      '2026-04-07',
    );
  });

  it('syncExternal routes JIRA to syncJiraWorklogs', async () => {
    mockPrisma.integrationConnection.findFirst.mockResolvedValueOnce({ id: 'int-jira' });
    mockPrisma.contract.findFirst.mockResolvedValueOnce({ id: CONTRACT_ID });

    await caller.syncExternal({
      provider: 'JIRA',
      startDate: '2026-04-01',
      endDate: '2026-04-07',
    });

    expect(mockSyncJira).toHaveBeenCalledWith(
      mockPrisma,
      ORG_ID,
      CONTRACTOR_ID,
      CONTRACT_ID,
      TS_ID,
      'int-jira',
      '2026-04-01',
      '2026-04-07',
    );
  });
});
