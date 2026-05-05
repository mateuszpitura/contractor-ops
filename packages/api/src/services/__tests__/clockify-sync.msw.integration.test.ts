/**
 * Integration: real fetch calls to Clockify API intercepted by MSW mock handlers.
 * Verifies syncClockifyEntries() fetches time entries with X-Api-Key auth,
 * parses PT durations, and upserts TimeEntry records.
 */
import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-clockify';
const CONTRACTOR_ID = 'contractor-001';
const CONTRACT_ID = 'contract-001';
const TIMESHEET_ID = 'ts-001';
const CONNECTION_ID = 'conn-clockify-001';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    integrationConnection: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    integrationSyncLog: {
      create: vi.fn().mockResolvedValue({ id: 'sync-log-001' }),
      update: vi.fn().mockResolvedValue({}),
    },
    timeEntry: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _sum: { minutes: 300 } }),
    },
    timesheet: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn().mockReturnValue({
    accessToken: 'clockify-test-key',
    workspaceId: 'ws-001',
    userId: 'user-001',
    region: 'global',
  }),
}));

// Import after mocks are defined
const { syncClockifyEntries } = await import('../clockify-sync.js');

// ---------------------------------------------------------------------------
// MSW Server
// ---------------------------------------------------------------------------

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['clockify']),
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

describe('clockify-sync + MSW', () => {
  it('syncClockifyEntries imports entries and returns { imported, skipped }', async () => {
    // Connection mock — CONNECTED with workspaceId and userId in configJson
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      credentialsRef: 'encrypted-ref',
      status: 'CONNECTED',
      configJson: { workspaceId: 'ws-001', userId: 'user-001', region: 'global' },
    });

    // No existing time entries (all new)
    mockPrisma.timeEntry.findFirst.mockResolvedValue(null);

    const result = await syncClockifyEntries(
      mockPrisma as never,
      ORG_ID,
      CONTRACTOR_ID,
      CONTRACT_ID,
      TIMESHEET_ID,
      CONNECTION_ID,
      '2025-01-01',
      '2025-12-31',
    );

    // MSW clockify handler returns 2 entries: PT4H0M0S (240 min) and PT1H0M0S (60 min)
    expect(result).toEqual({ imported: 2, skipped: 0 });

    // Verify timeEntry.create was called for each entry
    expect(mockPrisma.timeEntry.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          contractorId: CONTRACTOR_ID,
          contractId: CONTRACT_ID,
          timesheetId: TIMESHEET_ID,
          source: 'CLOCKIFY',
          minutes: 240,
        }),
      }),
    );
    expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'CLOCKIFY',
          minutes: 60,
        }),
      }),
    );

    // Verify timesheet totalMinutes was recalculated
    expect(mockPrisma.timesheet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TIMESHEET_ID },
      }),
    );

    // Verify sync log was updated to SUCCESS
    expect(mockPrisma.integrationSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    );
  });

  it('skips existing entries (updates them) and counts as skipped', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      credentialsRef: 'encrypted-ref',
      status: 'CONNECTED',
      configJson: { workspaceId: 'ws-001', userId: 'user-001', region: 'global' },
    });

    // All entries already exist
    mockPrisma.timeEntry.findFirst.mockResolvedValue({ id: 'existing-te-001' });

    const result = await syncClockifyEntries(
      mockPrisma as never,
      ORG_ID,
      CONTRACTOR_ID,
      CONTRACT_ID,
      TIMESHEET_ID,
      CONNECTION_ID,
      '2025-01-01',
      '2025-12-31',
    );

    expect(result).toEqual({ imported: 0, skipped: 2 });
    expect(mockPrisma.timeEntry.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('throws when connection is not found', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(null);

    await expect(
      syncClockifyEntries(
        mockPrisma as never,
        ORG_ID,
        CONTRACTOR_ID,
        CONTRACT_ID,
        TIMESHEET_ID,
        CONNECTION_ID,
        '2025-01-01',
        '2025-12-31',
      ),
    ).rejects.toThrow('Clockify connection not found');
  });

  it('throws when connection status is not CONNECTED', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      credentialsRef: 'encrypted-ref',
      status: 'DISCONNECTED',
      configJson: { workspaceId: 'ws-001', userId: 'user-001', region: 'global' },
    });

    await expect(
      syncClockifyEntries(
        mockPrisma as never,
        ORG_ID,
        CONTRACTOR_ID,
        CONTRACT_ID,
        TIMESHEET_ID,
        CONNECTION_ID,
        '2025-01-01',
        '2025-12-31',
      ),
    ).rejects.toThrow('Clockify connection is not active');
  });
});
