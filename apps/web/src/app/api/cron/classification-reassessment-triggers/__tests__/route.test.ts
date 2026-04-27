/** @vitest-environment node */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRunScan, mockCapture } = vi.hoisted(() => ({
  mockRunScan: vi.fn(async () => ({
    scanned: 2,
    material: 1,
    triggersCreated: 1,
    triggersAppended: 0,
  })),
  mockCapture: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/reassessment-trigger-scan', () => ({
  runReassessmentTriggerScan: mockRunScan,
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  withCronMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  CronMonitors: { CLASSIFICATION_REASSESSMENT_TRIGGERS: 'classification-reassessment-triggers' },
}));

vi.mock('@sentry/nextjs', () => ({
  withMonitor: vi.fn((_name: string, fn: () => Promise<Response>) => fn()),
  captureException: mockCapture,
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  return {
    createLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createTrpcLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: { gauge: vi.fn(), increment: vi.fn(), distribution: vi.fn() },
}));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: true, source: 'unleash' })),
  buildFlagBag: vi.fn(() => ({})),
  lazyFlagBag: vi.fn(() => ({})),
}));

import { GET, POST } from '../route';

describe('GET /api/cron/classification-reassessment-triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunScan.mockResolvedValue({
      scanned: 2,
      material: 1,
      triggersCreated: 1,
      triggersAppended: 0,
    });
  });

  it('returns 401 when the Authorization header is missing', async () => {
    process.env.CRON_SECRET = 's3cret';
    const req = new NextRequest('http://localhost/api/cron/classification-reassessment-triggers');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockRunScan).not.toHaveBeenCalled();
  });

  it('returns 401 when the Bearer token does not match', async () => {
    process.env.CRON_SECRET = 's3cret';
    const req = new NextRequest('http://localhost/api/cron/classification-reassessment-triggers', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with scan result JSON when authorised', async () => {
    process.env.CRON_SECRET = 's3cret';
    const req = new NextRequest('http://localhost/api/cron/classification-reassessment-triggers', {
      headers: { authorization: 'Bearer s3cret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, number>;
    expect(body.triggersCreated).toBe(1);
    expect(mockRunScan).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and captures to Sentry when the scan throws', async () => {
    process.env.CRON_SECRET = 's3cret';
    mockRunScan.mockRejectedValueOnce(new Error('boom'));
    const req = new NextRequest('http://localhost/api/cron/classification-reassessment-triggers', {
      headers: { authorization: 'Bearer s3cret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    expect(mockCapture).toHaveBeenCalled();
  });

  it('POST handler mirrors GET', async () => {
    process.env.CRON_SECRET = 's3cret';
    const req = new NextRequest('http://localhost/api/cron/classification-reassessment-triggers', {
      method: 'POST',
      headers: { authorization: 'Bearer s3cret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
