import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn().mockReturnValue({ accessToken: 'test-token' }),
}));

// ---------------------------------------------------------------------------
// Helpers to build mock Prisma + fetch
// ---------------------------------------------------------------------------

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    integrationConnection: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'conn-1',
        status: 'CONNECTED',
        credentialsRef: 'ref-1',
        configJson: { cloudId: 'cloud-123', accountId: 'acc-456' },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    integrationSyncLog: {
      create: vi.fn().mockResolvedValue({ id: 'sync-log-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    externalLink: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    timeEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _sum: { minutes: 120 } }),
    },
    timesheet: {
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function mockFetchResponses(
  responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>,
) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return Promise.resolve({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      json: () => Promise.resolve(resp.body),
      text: () => Promise.resolve(JSON.stringify(resp.body)),
      headers: {
        get: (key: string) => resp.headers?.[key] ?? null,
      },
    });
  });
}

function makeSearchResponse(
  issues: Array<{ key: string; summary: string }>,
  opts: { startAt?: number; total?: number } = {},
) {
  return {
    issues: issues.map(i => ({ key: i.key, fields: { summary: i.summary } })),
    startAt: opts.startAt ?? 0,
    maxResults: 100,
    total: opts.total ?? issues.length,
  };
}

function makeWorklogResponse(
  worklogs: Array<{ id: string; accountId: string; seconds: number; started?: string }>,
  opts: { total?: number } = {},
) {
  return {
    worklogs: worklogs.map(w => ({
      id: w.id,
      author: { accountId: w.accountId, displayName: 'Test User' },
      started: w.started ?? '2024-01-15T10:00:00.000+0000',
      timeSpentSeconds: w.seconds,
    })),
    startAt: 0,
    maxResults: 1000,
    total: opts.total ?? worklogs.length,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jira-worklog', () => {
  let syncJiraWorklogs: typeof import('../../services/jira-worklog-sync').syncJiraWorklogs;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    const mod = await import('../../services/jira-worklog-sync');
    syncJiraWorklogs = mod.syncJiraWorklogs;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseArgs = [
    'org-1',
    'contractor-1',
    'contract-1',
    'timesheet-1',
    'conn-1',
    '2024-01-01',
    '2024-01-31',
  ] as const;

  describe('syncJiraWorklogs', () => {
    it('performs JQL search for issues with user worklogs in date range', async () => {
      const prisma = createMockPrisma();
      const fetchMock = mockFetchResponses([{ status: 200, body: makeSearchResponse([]) }]);
      vi.stubGlobal('fetch', fetchMock);

      await syncJiraWorklogs(prisma, ...baseArgs);

      const searchCall = fetchMock.mock.calls[0];
      const url = new URL(searchCall[0] as string);
      const jql = url.searchParams.get('jql');

      expect(jql).toContain('worklogDate>="2024-01-01"');
      expect(jql).toContain('worklogDate<="2024-01-31"');
      expect(jql).toContain('worklogAuthor="acc-456"');
      expect(url.searchParams.get('fields')).toBe('key,summary');
    });

    it('fetches worklogs per issue and filters by accountId', async () => {
      const prisma = createMockPrisma();
      const fetchMock = mockFetchResponses([
        // Search response
        { status: 200, body: makeSearchResponse([{ key: 'PROJ-1', summary: 'Task 1' }]) },
        // Worklog response with mixed authors
        {
          status: 200,
          body: makeWorklogResponse([
            { id: 'wl-1', accountId: 'acc-456', seconds: 3600 },
            { id: 'wl-2', accountId: 'other-user', seconds: 1800 },
          ]),
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      await syncJiraWorklogs(prisma, ...baseArgs);

      // Only the matching accountId worklog should be created
      expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalId: 'wl-1',
          }),
        }),
      );
    });

    it('converts timeSpentSeconds to integer minutes', async () => {
      const prisma = createMockPrisma();
      const fetchMock = mockFetchResponses([
        { status: 200, body: makeSearchResponse([{ key: 'PROJ-1', summary: 'Task' }]) },
        {
          status: 200,
          body: makeWorklogResponse([{ id: 'wl-1', accountId: 'acc-456', seconds: 3600 }]),
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      await syncJiraWorklogs(prisma, ...baseArgs);

      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            minutes: 60, // 3600 / 60
          }),
        }),
      );
    });

    it('deduplicates worklogs by externalId using findFirst + update', async () => {
      const prisma = createMockPrisma();
      prisma.timeEntry.findFirst.mockResolvedValue({ id: 'existing-entry-1' });

      const fetchMock = mockFetchResponses([
        { status: 200, body: makeSearchResponse([{ key: 'PROJ-1', summary: 'Task' }]) },
        {
          status: 200,
          body: makeWorklogResponse([{ id: 'wl-1', accountId: 'acc-456', seconds: 7200 }]),
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      const result = await syncJiraWorklogs(prisma, ...baseArgs);

      // Should update, not create
      expect(prisma.timeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-entry-1' },
          data: expect.objectContaining({ minutes: 120 }),
        }),
      );
      expect(prisma.timeEntry.create).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(0);
    });

    it('sets source=JIRA on all imported entries', async () => {
      const prisma = createMockPrisma();
      const fetchMock = mockFetchResponses([
        { status: 200, body: makeSearchResponse([{ key: 'PROJ-1', summary: 'Task' }]) },
        {
          status: 200,
          body: makeWorklogResponse([{ id: 'wl-1', accountId: 'acc-456', seconds: 1800 }]),
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      await syncJiraWorklogs(prisma, ...baseArgs);

      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'JIRA',
          }),
        }),
      );
    });

    it('stores issueKey and issueSummary in metadataJson', async () => {
      const prisma = createMockPrisma();
      const fetchMock = mockFetchResponses([
        { status: 200, body: makeSearchResponse([{ key: 'DEV-42', summary: 'Fix login bug' }]) },
        {
          status: 200,
          body: makeWorklogResponse([{ id: 'wl-1', accountId: 'acc-456', seconds: 900 }]),
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      await syncJiraWorklogs(prisma, ...baseArgs);

      expect(prisma.timeEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadataJson: expect.objectContaining({
              issueKey: 'DEV-42',
              issueSummary: 'Fix login bug',
              worklogId: 'wl-1',
            }),
          }),
        }),
      );
    });

    it('paginates JQL search with startAt parameter', async () => {
      const prisma = createMockPrisma();

      // Page 1: 100 issues but total=150 so needs page 2
      const page1Issues = Array.from({ length: 100 }, (_, i) => ({
        key: `PROJ-${i}`,
        summary: `Task ${i}`,
      }));
      const page2Issues = Array.from({ length: 50 }, (_, i) => ({
        key: `PROJ-${100 + i}`,
        summary: `Task ${100 + i}`,
      }));

      const fetchMock = mockFetchResponses([
        { status: 200, body: makeSearchResponse(page1Issues, { total: 150 }) },
        { status: 200, body: makeSearchResponse(page2Issues, { startAt: 100, total: 150 }) },
        // Worklog responses for each issue (all empty to keep test focused)
        ...Array.from({ length: 150 }, () => ({
          status: 200,
          body: makeWorklogResponse([]),
        })),
      ]);
      vi.stubGlobal('fetch', fetchMock);

      await syncJiraWorklogs(prisma, ...baseArgs);

      // Verify second search call uses startAt=100
      const secondSearchCall = fetchMock.mock.calls[1];
      const url = new URL(secondSearchCall[0] as string);
      expect(url.searchParams.get('startAt')).toBe('100');
    });

    it('recalculates timesheet totalMinutes after import', async () => {
      const prisma = createMockPrisma();
      prisma.timeEntry.aggregate.mockResolvedValue({ _sum: { minutes: 180 } });

      const fetchMock = mockFetchResponses([
        { status: 200, body: makeSearchResponse([{ key: 'PROJ-1', summary: 'Task' }]) },
        {
          status: 200,
          body: makeWorklogResponse([{ id: 'wl-1', accountId: 'acc-456', seconds: 3600 }]),
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      await syncJiraWorklogs(prisma, ...baseArgs);

      expect(prisma.timeEntry.aggregate).toHaveBeenCalledWith({
        where: { timesheetId: 'timesheet-1' },
        _sum: { minutes: true },
      });
      expect(prisma.timesheet.update).toHaveBeenCalledWith({
        where: { id: 'timesheet-1' },
        data: { totalMinutes: 180 },
      });
    });

    it('returns count of imported and skipped worklogs', async () => {
      const prisma = createMockPrisma();
      // First call: not found (will create), second call: found (will update/skip)
      prisma.timeEntry.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-1' });

      const fetchMock = mockFetchResponses([
        { status: 200, body: makeSearchResponse([{ key: 'PROJ-1', summary: 'Task' }]) },
        {
          status: 200,
          body: makeWorklogResponse([
            { id: 'wl-1', accountId: 'acc-456', seconds: 1800 },
            { id: 'wl-2', accountId: 'acc-456', seconds: 3600 },
          ]),
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      const result = await syncJiraWorklogs(prisma, ...baseArgs);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('handles 401 with reconnect error message', async () => {
      const prisma = createMockPrisma();
      const fetchMock = mockFetchResponses([{ status: 401, body: { message: 'Unauthorized' } }]);
      vi.stubGlobal('fetch', fetchMock);

      await expect(syncJiraWorklogs(prisma, ...baseArgs)).rejects.toThrow(TRPCError);

      await expect(syncJiraWorklogs(prisma, ...baseArgs)).rejects.toThrow(/jiraTokenInvalid/);
    });
  });
});
