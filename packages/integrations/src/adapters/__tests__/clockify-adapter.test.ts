import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOCKIFY_REGIONS, ClockifyAdapter } from '../clockify-adapter.js';

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    integrationSyncLog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

describe('ClockifyAdapter', () => {
  let adapter: ClockifyAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ClockifyAdapter();
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
  });

  it('exposes regional API base URLs', () => {
    expect(CLOCKIFY_REGIONS.global).toContain('api.clockify.me');
    expect(CLOCKIFY_REGIONS.eu).toContain('euc1.clockify.me');
  });

  it('returns DISCONNECTED when connection is missing', async () => {
    mockFindUnique.mockResolvedValue(null);

    const h = await adapter.getHealthStatus('missing');

    expect(h.status).toBe('DISCONNECTED');
    expect(h.provider).toBe('clockify');
  });

  it('returns CONNECTED when status is CONNECTED and no failure signals', async () => {
    mockFindUnique.mockResolvedValue({
      provider: 'CLOCKIFY',
      displayName: 'Clockify',
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      status: 'CONNECTED',
    });
    mockFindMany.mockResolvedValue([
      {
        id: 'log-1',
        syncType: 'TIME',
        status: 'SUCCESS',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    const h = await adapter.getHealthStatus('conn-1');

    expect(h.status).toBe('CONNECTED');
    expect(h.displayName).toBe('Clockify');
  });

  it('returns ERROR when connected but only lastError and no success', async () => {
    mockFindUnique.mockResolvedValue({
      provider: 'CLOCKIFY',
      displayName: 'Clockify',
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: new Date(),
      lastErrorMessage: 'fail',
      status: 'CONNECTED',
    });

    const h = await adapter.getHealthStatus('conn-1');

    expect(h.status).toBe('ERROR');
  });

  it('returns DISCONNECTED when connection status is not CONNECTED', async () => {
    mockFindUnique.mockResolvedValue({
      provider: 'CLOCKIFY',
      displayName: 'Clockify',
      connectedAt: new Date(),
      lastSyncAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      status: 'PENDING_MAPPING',
    });

    const h = await adapter.getHealthStatus('conn-1');

    expect(h.status).toBe('DISCONNECTED');
  });

  it('returns ERROR when latest sync log is FAILED (even if connection has prior success)', async () => {
    mockFindUnique.mockResolvedValue({
      provider: 'CLOCKIFY',
      displayName: 'Clockify',
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      lastSuccessAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
      status: 'CONNECTED',
    });
    mockFindMany.mockResolvedValue([
      {
        id: 'log-fail',
        syncType: 'TIME',
        status: 'FAILED',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    ]);

    const h = await adapter.getHealthStatus('conn-1');

    expect(h.status).toBe('ERROR');
  });
});
