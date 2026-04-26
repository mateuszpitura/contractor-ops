/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunScan, mockMetricsGauge, mockCapture } = vi.hoisted(() => ({
  mockRunScan: vi.fn(async () => ({ scanned: 3, crossings: 1, notificationsDispatched: 1 })),
  mockMetricsGauge: vi.fn(),
  mockCapture: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/economic-dependency-scan', () => ({
  runEconomicDependencyScan: mockRunScan,
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withCronMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  CronMonitors: { CLASSIFICATION_ECONOMIC_DEPENDENCY: 'classification-economic-dependency' },
}));

vi.mock('@sentry/nextjs', () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  captureException: mockCapture,
}));

vi.mock('@contractor-ops/logger', () => ({
  createCronLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: mockMetricsGauge, increment: vi.fn(), distribution: vi.fn() },
}));

import { GET, POST } from '../route';

describe('GET /api/cron/classification-economic-dependency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunScan.mockResolvedValue({ scanned: 3, crossings: 1, notificationsDispatched: 1 });
  });

  it('returns 401 when the Authorization header is missing', async () => {
    process.env.CRON_SECRET = 's3cret';
    const req = new NextRequest('http://localhost/api/cron/classification-economic-dependency');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockRunScan).not.toHaveBeenCalled();
  });

  it('returns 401 when the Bearer token does not match CRON_SECRET', async () => {
    process.env.CRON_SECRET = 's3cret';
    const req = new NextRequest('http://localhost/api/cron/classification-economic-dependency', {
      headers: { authorization: 'Bearer wrong-token' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockRunScan).not.toHaveBeenCalled();
  });

  it('returns 200 with scan result JSON when authorised', async () => {
    process.env.CRON_SECRET = 's3cret';
    const req = new NextRequest('http://localhost/api/cron/classification-economic-dependency', {
      headers: { authorization: 'Bearer s3cret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ scanned: 3, crossings: 1, notificationsDispatched: 1 });
    expect(mockRunScan).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and captures to Sentry when the scan throws', async () => {
    process.env.CRON_SECRET = 's3cret';
    mockRunScan.mockRejectedValueOnce(new Error('boom'));
    const req = new NextRequest('http://localhost/api/cron/classification-economic-dependency', {
      headers: { authorization: 'Bearer s3cret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    expect(mockCapture).toHaveBeenCalled();
  });

  it('POST handler mirrors GET (same auth + scan path)', async () => {
    process.env.CRON_SECRET = 's3cret';
    const req = new NextRequest('http://localhost/api/cron/classification-economic-dependency', {
      method: 'POST',
      headers: { authorization: 'Bearer s3cret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
