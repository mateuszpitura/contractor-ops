/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindMany, mockUpdateMany, mockUpdate, mockCount, mockQueueWebhookProcessing } =
  vi.hoisted(() => ({
    mockFindMany: vi.fn(),
    mockUpdateMany: vi.fn(),
    mockUpdate: vi.fn(),
    mockCount: vi.fn(),
    mockQueueWebhookProcessing: vi.fn(),
  }));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    webhookDelivery: {
      findMany: mockFindMany,
      updateMany: mockUpdateMany,
      update: mockUpdate,
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

// F-INT-13 reaper publishes via webhook-dispatcher; mock the helper directly
// so the test does not have to mock the QStash client transitively.
vi.mock('@contractor-ops/integrations/services/webhook-dispatcher', () => ({
  queueWebhookProcessing: mockQueueWebhookProcessing,
}));

vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  // The webhook-dispatcher import pulls in registry.ts which calls
  // createIntegrationLogger at module evaluation time — provide a stub.
  createIntegrationLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn() },
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn(() => ({ CRON_SECRET: 'test-cron-secret-16chars' })),
}));

import { GET } from '../route';

describe('GET /api/cron/job-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockUpdate.mockResolvedValue({ id: 'd1' });
    mockCount.mockResolvedValue(0);
    mockQueueWebhookProcessing.mockResolvedValue(undefined);
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
    process.env.CRON_SECRET = 'test-cron-secret-16chars';
    const req = new NextRequest('http://localhost/api/cron/job-health', {
      headers: { authorization: 'Bearer test-cron-secret-16chars' },
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
      staleRetried: 0,
      staleCleared: 0,
      healthy: true,
    });
    expect(mockFindMany).toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalled();
  });

  it('re-enqueues a stale row whose attempt budget is not yet exhausted', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-16chars';
    mockFindMany.mockResolvedValue([
      {
        id: 'd1',
        provider: 'SLACK',
        organizationId: 'org-1',
        eventType: 'event_callback',
        receivedAt: new Date('2026-05-04T10:00:00Z'),
        deliveryStatus: 'PROCESSING',
        attempts: 1,
      },
    ]);

    const req = new NextRequest('http://localhost/api/cron/job-health', {
      headers: { authorization: 'Bearer test-cron-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    // Reaper bumps attempts and re-enqueues — it does NOT mark the row
    // FAILED until the attempt budget is exhausted.
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({
          deliveryStatus: 'RECEIVED',
          attempts: 2,
        }),
      }),
    );
    expect(mockQueueWebhookProcessing).toHaveBeenCalledWith('d1', 'slack');
    expect(mockUpdateMany).not.toHaveBeenCalled();

    const json = (await res.json()) as { staleRetried: number; staleCleared: number };
    expect(json.staleRetried).toBe(1);
    expect(json.staleCleared).toBe(0);
  });

  it('marks a stale row FAILED once the attempt budget is exhausted', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-16chars';
    mockFindMany.mockResolvedValue([
      {
        id: 'd2',
        provider: 'SLACK',
        organizationId: 'org-1',
        eventType: 'event_callback',
        receivedAt: new Date('2026-05-04T10:00:00Z'),
        deliveryStatus: 'PROCESSING',
        // 4 attempts already made; one more (5) hits MAX_REAPER_ATTEMPTS.
        attempts: 4,
      },
    ]);

    const req = new NextRequest('http://localhost/api/cron/job-health', {
      headers: { authorization: 'Bearer test-cron-secret-16chars' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockQueueWebhookProcessing).not.toHaveBeenCalled();
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['d2'] } },
        data: expect.objectContaining({
          deliveryStatus: 'FAILED',
        }),
      }),
    );

    const json = (await res.json()) as { staleRetried: number; staleCleared: number };
    expect(json.staleRetried).toBe(0);
    expect(json.staleCleared).toBe(1);
  });
});
