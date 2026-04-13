/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockCount = vi.fn();

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      findMany: mockFindMany,
      updateMany: mockUpdateMany,
      count: mockCount,
    },
  },
}));

vi.mock('@sentry/nextjs', () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  captureMessage: vi.fn(),
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

describe('GET /api/cron/job-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockCount.mockResolvedValue(0);
  });

  it('returns 401 when unauthorized', async () => {
    process.env.CRON_SECRET = 's';
    const req = new NextRequest('http://localhost/api/cron/job-health', {
      headers: { authorization: 'Bearer nope' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with health payload when authorized', async () => {
    process.env.CRON_SECRET = 'ok';
    const req = new NextRequest('http://localhost/api/cron/job-health', {
      headers: { authorization: 'Bearer ok' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      pendingCount: number;
      recentFailureCount: number;
      staleCleared: number;
      healthy: boolean;
    };
    expect(json).toMatchObject({
      pendingCount: 0,
      recentFailureCount: 0,
      staleCleared: 0,
      healthy: true,
    });
    expect(mockFindMany).toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalled();
  });
});
