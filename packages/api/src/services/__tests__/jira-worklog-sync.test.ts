/**
 * Unit tests for jira-worklog-sync.ts
 *
 * Covers syncJiraWorklogs with mocked fetch and Prisma — complements the
 * MSW integration test which exercises real HTTP via intercepted fetch.
 */
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma, mockDecryptCredentials } = vi.hoisted(() => {
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
      aggregate: vi.fn().mockResolvedValue({ _sum: { minutes: 120 } }),
    },
    timesheet: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    mockPrisma,
    mockDecryptCredentials: vi.fn().mockReturnValue({ accessToken: 'test-token' }),
  };
});

vi.mock('@contractor-ops/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: mockDecryptCredentials,
}));

import { syncJiraWorklogs } from '../jira-worklog-sync.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-jira-unit';
const CONTRACTOR_ID = 'contractor-001';
const CONTRACT_ID = 'contract-001';
const TIMESHEET_ID = 'ts-001';
const CONNECTION_ID = 'conn-jira-001';

function connectedConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: CONNECTION_ID,
    status: 'CONNECTED',
    credentialsRef: 'enc-ref',
    configJson: { cloudId: 'cloud-123', accountId: 'acct-456' },
    ...overrides,
  };
}

function mockFetchJson(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncJiraWorklogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('throws NOT_FOUND when connection does not exist', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(null);

    await expect(
      syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31'),
    ).rejects.toThrow(TRPCError);

    try {
      await syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31');
    } catch (e) {
      expect((e as TRPCError).code).toBe('NOT_FOUND');
    }
  });

  it('throws PRECONDITION_FAILED when connection is not CONNECTED', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(
      connectedConnection({ status: 'DISCONNECTED' }),
    );

    try {
      await syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31');
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('PRECONDITION_FAILED');
    }
  });

  it('throws BAD_REQUEST when cloudId is missing', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(
      connectedConnection({ configJson: {} }),
    );

    try {
      await syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31');
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('BAD_REQUEST');
      expect((e as TRPCError).message).toContain('cloudId');
    }
  });

  it('resolves accountId from externalLink when not in config', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(
      connectedConnection({ configJson: { cloudId: 'cloud-123' } }),
    );
    mockPrisma.externalLink.findFirst.mockResolvedValue({
      externalId: 'resolved-acct-id',
    });

    // Mock fetch to return empty search results
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetchJson({ issues: [], startAt: 0, maxResults: 100, total: 0 }),
    );

    await syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31');

    expect(mockPrisma.externalLink.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: ORG_ID,
        integrationConnectionId: CONNECTION_ID,
        entityType: 'CONTRACTOR',
        entityId: CONTRACTOR_ID,
        externalType: 'JIRA_USER',
      }),
    });

    fetchSpy.mockRestore();
  });

  it('throws BAD_REQUEST when accountId cannot be resolved', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(
      connectedConnection({ configJson: { cloudId: 'cloud-123' } }),
    );
    mockPrisma.externalLink.findFirst.mockResolvedValue(null);

    try {
      await syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31');
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('BAD_REQUEST');
      expect((e as TRPCError).message).toContain('Jira account ID not found');
    }
  });

  it('throws UNAUTHORIZED on 401 from Jira search API', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(connectedConnection());

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetchJson({}, 401),
    );

    try {
      await syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31');
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('UNAUTHORIZED');
    }

    fetchSpy.mockRestore();
  });

  it('throws TOO_MANY_REQUESTS on 429 from Jira search API', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(connectedConnection());

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '30' }),
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue(''),
      }),
    );

    try {
      await syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31');
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe('TOO_MANY_REQUESTS');
    }

    fetchSpy.mockRestore();
  });

  it('imports worklogs and returns correct counts', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(connectedConnection());
    mockPrisma.timeEntry.findFirst.mockResolvedValue(null); // No existing entries

    const searchResponse = {
      issues: [
        { key: 'PROJ-1', fields: { summary: 'Task one' } },
      ],
      startAt: 0,
      maxResults: 100,
      total: 1,
    };

    const worklogResponse = {
      worklogs: [
        {
          id: 'wl-1',
          author: { accountId: 'acct-456', displayName: 'Dev' },
          started: '2026-01-15T09:00:00.000+0000',
          timeSpentSeconds: 3600,
          comment: null,
        },
        {
          id: 'wl-2',
          author: { accountId: 'acct-456', displayName: 'Dev' },
          started: '2026-01-16T10:00:00.000+0000',
          timeSpentSeconds: 0, // zero duration -> skipped
          comment: null,
        },
      ],
      startAt: 0,
      maxResults: 1000,
      total: 2,
    };

    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++;
      const data = callCount === 1 ? searchResponse : worklogResponse;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
      } as Response);
    });

    const result = await syncJiraWorklogs(
      mockPrisma as never,
      ORG_ID,
      CONTRACTOR_ID,
      CONTRACT_ID,
      TIMESHEET_ID,
      CONNECTION_ID,
      '2026-01-01',
      '2026-01-31',
    );

    expect(result).toEqual({ imported: 1, skipped: 1 });

    // Verify timeEntry was created for wl-1
    expect(mockPrisma.timeEntry.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        contractorId: CONTRACTOR_ID,
        contractId: CONTRACT_ID,
        timesheetId: TIMESHEET_ID,
        minutes: 60,
        source: 'JIRA',
        externalId: 'wl-1',
      }),
    });

    // Verify timesheet total recalculated
    expect(mockPrisma.timesheet.update).toHaveBeenCalledWith({
      where: { id: TIMESHEET_ID },
      data: { totalMinutes: 120 },
    });

    // Verify sync log updated to SUCCESS
    expect(mockPrisma.integrationSyncLog.update).toHaveBeenCalledWith({
      where: { id: 'sync-log-001' },
      data: expect.objectContaining({ status: 'SUCCESS' }),
    });

    fetchSpy.mockRestore();
  });

  it('skips existing worklogs and updates them instead', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(connectedConnection());
    mockPrisma.timeEntry.findFirst.mockResolvedValue({ id: 'existing-entry' });

    const searchResponse = {
      issues: [{ key: 'PROJ-1', fields: { summary: 'Existing task' } }],
      startAt: 0,
      maxResults: 100,
      total: 1,
    };

    const worklogResponse = {
      worklogs: [
        {
          id: 'wl-existing',
          author: { accountId: 'acct-456', displayName: 'Dev' },
          started: '2026-01-15T09:00:00.000+0000',
          timeSpentSeconds: 7200,
        },
      ],
      startAt: 0,
      maxResults: 1000,
      total: 1,
    };

    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++;
      const data = callCount === 1 ? searchResponse : worklogResponse;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
      } as Response);
    });

    const result = await syncJiraWorklogs(
      mockPrisma as never,
      ORG_ID,
      CONTRACTOR_ID,
      CONTRACT_ID,
      TIMESHEET_ID,
      CONNECTION_ID,
      '2026-01-01',
      '2026-01-31',
    );

    expect(result).toEqual({ imported: 0, skipped: 1 });
    expect(mockPrisma.timeEntry.update).toHaveBeenCalledWith({
      where: { id: 'existing-entry' },
      data: expect.objectContaining({ minutes: 120 }),
    });
    expect(mockPrisma.timeEntry.create).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('updates sync log with FAILED on error', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue(connectedConnection());

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      }),
    );

    await expect(
      syncJiraWorklogs(mockPrisma as never, ORG_ID, CONTRACTOR_ID, CONTRACT_ID, TIMESHEET_ID, CONNECTION_ID, '2026-01-01', '2026-01-31'),
    ).rejects.toThrow();

    expect(mockPrisma.integrationSyncLog.update).toHaveBeenCalledWith({
      where: { id: 'sync-log-001' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });

    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: CONNECTION_ID },
      data: expect.objectContaining({
        lastErrorMessage: expect.any(String),
      }),
    });

    fetchSpy.mockRestore();
  });
});
