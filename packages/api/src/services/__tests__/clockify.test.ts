import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

const { mockFetchWithTimeout } = vi.hoisted(() => ({
  mockFetchWithTimeout: vi.fn(),
}));

vi.mock('@contractor-ops/integrations', () => ({
  fetchWithTimeout: mockFetchWithTimeout,
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn().mockReturnValue({ accessToken: 'fake-api-key' }),
}));

vi.mock('@contractor-ops/integrations/adapters/clockify-adapter', () => ({
  CLOCKIFY_REGIONS: {
    global: 'https://api.clockify.me/api/v1',
    eu: 'https://euc1.clockify.me/api/v1',
    us: 'https://use2.clockify.me/api/v1',
  },
}));

import { parseDurationToMinutes, syncClockifyEntries } from '../clockify-sync';

// ---------------------------------------------------------------------------
// Prisma mock builder
// ---------------------------------------------------------------------------

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    integrationConnection: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'conn_1',
        status: 'CONNECTED',
        credentialsRef: 'encrypted-ref',
        configJson: {
          workspaceId: 'ws_1',
          userId: 'clockify_user_1',
          region: 'global',
        },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    integrationSyncLog: {
      create: vi.fn().mockResolvedValue({ id: 'sync_log_1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    timeEntry: {
      findFirst: vi.fn().mockResolvedValue(null), // no duplicates by default
      create: vi.fn().mockResolvedValue({ id: 'te_new' }),
      update: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _sum: { minutes: 90 } }),
    },
    timesheet: {
      findUnique: vi.fn().mockResolvedValue({ status: 'DRAFT' }),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fetch mock helper
// ---------------------------------------------------------------------------

function mockFetchResponse(entries: unknown[], status = 200) {
  mockFetchWithTimeout.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(entries),
    text: () => Promise.resolve(JSON.stringify(entries)),
    headers: { get: () => null },
  });
  return mockFetchWithTimeout;
}

function makeClockifyEntry(id: string, duration: string, description = 'Work') {
  return {
    id,
    description,
    timeInterval: {
      start: '2024-06-15T09:00:00Z',
      end: '2024-06-15T10:30:00Z',
      duration,
    },
    projectId: 'proj_1',
    project: { name: 'Project Alpha' },
  };
}

// ---------------------------------------------------------------------------
// parseDurationToMinutes (existing tests)
// ---------------------------------------------------------------------------

describe('clockify', () => {
  describe('parseDurationToMinutes', () => {
    it('parses PT1H30M to 90', () => {
      expect(parseDurationToMinutes('PT1H30M')).toBe(90);
    });

    it('parses PT2H to 120', () => {
      expect(parseDurationToMinutes('PT2H')).toBe(120);
    });

    it('parses PT45M to 45', () => {
      expect(parseDurationToMinutes('PT45M')).toBe(45);
    });

    it('parses PT0S to 0', () => {
      expect(parseDurationToMinutes('PT0S')).toBe(0);
    });

    it('rounds seconds >= 30 up to next minute (PT45M30S -> 46)', () => {
      expect(parseDurationToMinutes('PT45M30S')).toBe(46);
    });

    it('parses PT1H to 60', () => {
      expect(parseDurationToMinutes('PT1H')).toBe(60);
    });

    it('rounds PT30S up to 1 minute', () => {
      expect(parseDurationToMinutes('PT30S')).toBe(1);
    });

    it('does not round PT29S (stays 0)', () => {
      expect(parseDurationToMinutes('PT29S')).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // syncClockifyEntries
  // -------------------------------------------------------------------------

  describe('syncClockifyEntries', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      vi.clearAllMocks();
      mockFetchWithTimeout.mockReset();
      mockPrisma = createMockPrisma();
    });

    it('uses correct regional base URL for API calls', async () => {
      const entries = [makeClockifyEntry('e1', 'PT1H30M')];
      const fetchSpy = mockFetchResponse(entries);

      await syncClockifyEntries(
        mockPrisma,
        'org_1',
        'contractor_1',
        'contract_1',
        'ts_1',
        'conn_1',
        '2024-06-01',
        '2024-06-30',
      );

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://api.clockify.me/api/v1');
      expect(calledUrl).toContain('/workspaces/ws_1/user/clockify_user_1/time-entries');
    });

    it('uses EU regional URL when region is eu', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValueOnce({
        id: 'conn_1',
        status: 'CONNECTED',
        credentialsRef: 'encrypted-ref',
        configJson: { workspaceId: 'ws_1', userId: 'cu_1', region: 'eu' },
      });

      const fetchSpy = mockFetchResponse([]);

      await syncClockifyEntries(
        mockPrisma,
        'org_1',
        'c_1',
        'ct_1',
        'ts_1',
        'conn_1',
        '2024-06-01',
        '2024-06-30',
      );

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://euc1.clockify.me/api/v1');
    });

    it('paginates with page-size=100', async () => {
      // First page: 100 entries (triggers next page fetch)
      const page1 = Array.from({ length: 100 }, (_, i) => makeClockifyEntry(`e${i}`, 'PT1H'));
      // Second page: fewer than 100 (last page)
      const page2 = [makeClockifyEntry('e100', 'PT30M')];

      mockFetchWithTimeout
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(page1),
          headers: { get: () => null },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(page2),
          headers: { get: () => null },
        });
      const fetchSpy = mockFetchWithTimeout;

      const result = await syncClockifyEntries(
        mockPrisma,
        'org_1',
        'c_1',
        'ct_1',
        'ts_1',
        'conn_1',
        '2024-06-01',
        '2024-06-30',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Verify page-size param
      const url1 = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url1.searchParams.get('page-size')).toBe('100');
      expect(url1.searchParams.get('page')).toBe('1');

      const url2 = new URL(fetchSpy.mock.calls[1][0] as string);
      expect(url2.searchParams.get('page')).toBe('2');

      // 101 total entries imported
      expect(result.imported).toBe(101);
    });

    it('creates time entries with source=CLOCKIFY', async () => {
      const entries = [makeClockifyEntry('e1', 'PT1H')];
      mockFetchResponse(entries);

      await syncClockifyEntries(
        mockPrisma,
        'org_1',
        'c_1',
        'ct_1',
        'ts_1',
        'conn_1',
        '2024-06-01',
        '2024-06-30',
      );

      expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'CLOCKIFY',
          externalId: 'e1',
          minutes: 60,
          organizationId: 'org_1',
          contractorId: 'c_1',
          timesheetId: 'ts_1',
          contractId: 'ct_1',
        }),
      });
    });

    it('deduplicates by externalId — updates existing entry instead of creating', async () => {
      // Existing entry found
      mockPrisma.timeEntry.findFirst.mockResolvedValueOnce({ id: 'existing_te_1' });

      const entries = [makeClockifyEntry('e1', 'PT2H')];
      mockFetchResponse(entries);

      const result = await syncClockifyEntries(
        mockPrisma,
        'org_1',
        'c_1',
        'ct_1',
        'ts_1',
        'conn_1',
        '2024-06-01',
        '2024-06-30',
      );

      expect(mockPrisma.timeEntry.create).not.toHaveBeenCalled();
      expect(mockPrisma.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 'existing_te_1' },
        data: expect.objectContaining({ minutes: 120 }),
      });
      // Existing entries count as skipped
      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(0);
    });

    it('recalculates timesheet totalMinutes after sync', async () => {
      const entries = [makeClockifyEntry('e1', 'PT1H30M')];
      mockFetchResponse(entries);

      mockPrisma.timeEntry.aggregate.mockResolvedValueOnce({
        _sum: { minutes: 150 },
      });

      await syncClockifyEntries(
        mockPrisma,
        'org_1',
        'c_1',
        'ct_1',
        'ts_1',
        'conn_1',
        '2024-06-01',
        '2024-06-30',
      );

      expect(mockPrisma.timeEntry.aggregate).toHaveBeenCalledWith({
        where: { timesheetId: 'ts_1' },
        _sum: { minutes: true },
      });
      expect(mockPrisma.timesheet.update).toHaveBeenCalledWith({
        where: { id: 'ts_1' },
        data: { totalMinutes: 150 },
      });
    });

    it('throws UNAUTHORIZED TRPCError on 401 response', async () => {
      mockFetchResponse([], 401);

      await expect(
        syncClockifyEntries(
          mockPrisma,
          'org_1',
          'c_1',
          'ct_1',
          'ts_1',
          'conn_1',
          '2024-06-01',
          '2024-06-30',
        ),
      ).rejects.toThrow(/clockifyApiKeyInvalid/);

      // Sync log should be updated with FAILED status
      expect(mockPrisma.integrationSyncLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('throws NOT_FOUND when connection does not exist', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValueOnce(null);

      await expect(
        syncClockifyEntries(
          mockPrisma,
          'org_1',
          'c_1',
          'ct_1',
          'ts_1',
          'conn_1',
          '2024-06-01',
          '2024-06-30',
        ),
      ).rejects.toThrow(/clockifyConnectionNotFound/);
    });

    it('throws PRECONDITION_FAILED when connection is not CONNECTED', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValueOnce({
        id: 'conn_1',
        status: 'DISCONNECTED',
        credentialsRef: 'ref',
        configJson: { workspaceId: 'ws_1', userId: 'u_1', region: 'global' },
      });

      await expect(
        syncClockifyEntries(
          mockPrisma,
          'org_1',
          'c_1',
          'ct_1',
          'ts_1',
          'conn_1',
          '2024-06-01',
          '2024-06-30',
        ),
      ).rejects.toThrow(/clockifyConnectionNotActive/);
    });

    it('skips zero-duration entries', async () => {
      const entries = [
        makeClockifyEntry('e1', 'PT1H'),
        makeClockifyEntry('e2', 'PT0S'), // zero duration
      ];
      mockFetchResponse(entries);

      const result = await syncClockifyEntries(
        mockPrisma,
        'org_1',
        'c_1',
        'ct_1',
        'ts_1',
        'conn_1',
        '2024-06-01',
        '2024-06-30',
      );

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(mockPrisma.timeEntry.create).toHaveBeenCalledTimes(1);
    });

    it('passes API key from decrypted credentials in X-Api-Key header', async () => {
      mockFetchResponse([]);

      await syncClockifyEntries(
        mockPrisma,
        'org_1',
        'c_1',
        'ct_1',
        'ts_1',
        'conn_1',
        '2024-06-01',
        '2024-06-30',
      );

      const fetchCall = mockFetchWithTimeout.mock.calls[0];
      const headers = fetchCall[1]?.headers as Record<string, string>;
      expect(headers['X-Api-Key']).toBe('fake-api-key');
    });
  });
});
