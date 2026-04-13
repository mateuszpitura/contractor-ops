/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRefreshExpiring,
} = vi.hoisted(() => ({
  mockRefreshExpiring: vi.fn(),
}));

vi.mock('@contractor-ops/integrations', () => ({
  refreshExpiring: () => mockRefreshExpiring(),
}));

vi.mock('@sentry/nextjs', () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  captureException: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withCronMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
}));

vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn() },
}));

import { GET } from '../route';

describe('GET /api/cron/token-refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshExpiring.mockResolvedValue({
      refreshed: 2,
      total: 10,
      failed: 0,
    });
  });

  it('returns 401 when Authorization does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'secret';
    const req = new NextRequest('http://localhost/api/cron/token-refresh', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockRefreshExpiring).not.toHaveBeenCalled();
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/cron/token-refresh');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockRefreshExpiring).not.toHaveBeenCalled();
  });

  it('returns 200 with refresh stats when authorized', async () => {
    process.env.CRON_SECRET = 'good';
    const req = new NextRequest('http://localhost/api/cron/token-refresh', {
      headers: { authorization: 'Bearer good' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      refreshed: number;
      total: number;
      failed: number;
    };
    expect(json).toEqual({ refreshed: 2, total: 10, failed: 0 });
    expect(mockRefreshExpiring).toHaveBeenCalledOnce();
  });
});
