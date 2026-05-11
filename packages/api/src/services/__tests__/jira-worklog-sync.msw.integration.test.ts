/**
 * Integration: real fetch calls to Jira REST API intercepted by MSW mock handlers.
 * Verifies syncJiraWorklogs() correctly fetches issues via JQL search,
 * retrieves worklogs per issue, and upserts TimeEntry records.
 */
import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-jira-worklog';
const CONTRACTOR_ID = 'contractor-001';
const CONTRACT_ID = 'contract-001';
const TIMESHEET_ID = 'ts-001';
const CONNECTION_ID = 'conn-jira-001';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    integrationConnection: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    externalLink: {
      findFirst: vi.fn(),
    },
    integrationSyncLog: {
      create: vi.fn().mockResolvedValue({ id: 'sync-log-001' }),
      update: vi.fn().mockResolvedValue({}),
    },
    timeEntry: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _sum: { minutes: 60 } }),
    },
    timesheet: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn().mockReturnValue({
    accessToken: 'jira-test-token',
    cloudId: 'cloud-id-mock-001',
  }),
}));

// Import after mocks are defined
const { syncJiraWorklogs } = await import('../jira-worklog-sync');

// ---------------------------------------------------------------------------
// MSW Server
// ---------------------------------------------------------------------------

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['jira']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jira-worklog-sync + MSW', () => {
  it('syncJiraWorklogs imports worklogs and returns { imported, skipped }', async () => {
    // Connection mock — CONNECTED with cloudId in configJson
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      credentialsRef: 'encrypted-ref',
      status: 'CONNECTED',
      configJson: { cloudId: 'cloud-id-mock-001' },
    });

    // ExternalLink for accountId lookup
    mockPrisma.externalLink.findFirst.mockResolvedValue({
      id: 'el-001',
      externalId: 'user-001', // matches MSW worklog author accountId
    });

    // No existing time entries (all new)
    mockPrisma.timeEntry.findFirst.mockResolvedValue(null);

    const result = await syncJiraWorklogs(
      mockPrisma as never,
      ORG_ID,
      CONTRACTOR_ID,
      CONTRACT_ID,
      TIMESHEET_ID,
      CONNECTION_ID,
      '2025-01-01',
      '2027-12-31',
    );

    // MSW jira handler returns 1 issue from search and 1 worklog (3600s = 60 min)
    expect(result).toEqual({ imported: 1, skipped: 0 });

    // Verify timeEntry.create was called with correct data shape
    expect(mockPrisma.timeEntry.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          contractorId: CONTRACTOR_ID,
          contractId: CONTRACT_ID,
          timesheetId: TIMESHEET_ID,
          source: 'JIRA',
          minutes: 60,
        }),
      }),
    );

    // Verify timesheet totalMinutes was recalculated
    expect(mockPrisma.timesheet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TIMESHEET_ID },
        data: expect.objectContaining({ totalMinutes: 60 }),
      }),
    );

    // Verify sync log was updated to SUCCESS
    expect(mockPrisma.integrationSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    );
  });

  it('skips existing worklogs (updates them) and counts as skipped', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      credentialsRef: 'encrypted-ref',
      status: 'CONNECTED',
      configJson: { cloudId: 'cloud-id-mock-001' },
    });

    mockPrisma.externalLink.findFirst.mockResolvedValue({
      id: 'el-001',
      externalId: 'user-001',
    });

    // Existing entry found — should update (skipped)
    mockPrisma.timeEntry.findFirst.mockResolvedValue({ id: 'existing-te-001' });

    const result = await syncJiraWorklogs(
      mockPrisma as never,
      ORG_ID,
      CONTRACTOR_ID,
      CONTRACT_ID,
      TIMESHEET_ID,
      CONNECTION_ID,
      '2025-01-01',
      '2027-12-31',
    );

    expect(result).toEqual({ imported: 0, skipped: 1 });
    expect(mockPrisma.timeEntry.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('throws when connection is not found', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(null);

    await expect(
      syncJiraWorklogs(
        mockPrisma as never,
        ORG_ID,
        CONTRACTOR_ID,
        CONTRACT_ID,
        TIMESHEET_ID,
        CONNECTION_ID,
        '2025-01-01',
        '2025-12-31',
      ),
    ).rejects.toThrow('Jira connection not found');
  });
});
