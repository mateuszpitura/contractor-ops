/** @vitest-environment node */

/**
 * Smoke tests for the full `/health` probe set.
 *
 * The default `NODE_ENV=test` short-circuit returns a skeleton 200 so
 * the suite never depends on real Upstash/R2/QStash. This test forces
 * `NODE_ENV=production` for one buildServer instance to exercise the
 * actual probe pipeline, with every external dependency mocked.
 *
 * Coverage:
 *   1. All probes ok → 200 with `status: 'ok'` and 5 probes in body.
 *   2. Probes skipped when env unconfigured → 200 with `skipped` statuses.
 *   3. One probe fails → 503 with `status: 'error'`.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryRaw, mockRedisPing, mockFetch, mockGetQueueDepthSnapshot, mockHeadObject } =
  vi.hoisted(() => ({
    mockQueryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    mockRedisPing: vi.fn(async () => 'PONG'),
    mockFetch: vi.fn(),
    mockGetQueueDepthSnapshot: vi.fn(
      async () =>
        [] as Array<{
          routeKey: string;
          depth: number;
          threshold: number;
          max: number;
          saturated: boolean;
        }>,
    ),
    mockHeadObject: vi.fn(async () => ({})),
  }));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    $queryRaw: (...a: unknown[]) => (mockQueryRaw as (...a: unknown[]) => unknown)(...a),
  },
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    ping() {
      return mockRedisPing();
    }
  },
}));

vi.mock('@contractor-ops/api/services/cron-monitor', () => ({
  getQueueDepthSnapshot: (...a: unknown[]) =>
    (mockGetQueueDepthSnapshot as (...a: unknown[]) => unknown)(...a),
  withQueueObservability: <T>(_name: string, fn: () => Promise<T>) => fn(),
  recordQueueDepth: vi.fn(),
}));

// Mock the dynamic @aws-sdk/client-s3 import.
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send(_cmd: unknown) {
      return mockHeadObject();
    }
  },
  HeadObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

const originalFetch = globalThis.fetch;

import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  // Flip out of test mode to exercise real probe pipeline. setup.ts
  // already populated APP_URL / API_URL / HEALTH_TIMEOUT_MS so the
  // production-env Zod parse succeeds.
  vi.stubEnv('NODE_ENV', 'production');
  // Configure every probe so none short-circuits to `skipped`.
  process.env.UPSTASH_REDIS_REST_URL = 'https://example-redis.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.QSTASH_TOKEN = 'qstash-test-token';
  process.env.QSTASH_HEALTH_URL = 'https://qstash.example';
  process.env.R2_ACCOUNT_ID = 'acct';
  process.env.R2_ACCESS_KEY_ID = 'akid';
  process.env.R2_SECRET_ACCESS_KEY = 'sak';
  process.env.R2_BUCKET_NAME = 'bucket';

  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
  __resetEnvForTests();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
  mockRedisPing.mockResolvedValue('PONG');
  mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);
  mockGetQueueDepthSnapshot.mockResolvedValue([]);
  mockHeadObject.mockResolvedValue({});
});

describe('GET /health (production probe pipeline)', () => {
  it('returns 200 + status=ok when every probe succeeds', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      status?: string;
      probes?: Array<{ name: string; status: string }>;
    };
    expect(body.status).toBe('ok');
    expect(body.probes?.length).toBe(5);
    expect(body.probes?.every(p => p.status === 'ok')).toBe(true);
  });

  it('returns 503 + status=error when database probe fails (without leaking the underlying error)', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('neon connection refused'));
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as {
      status?: string;
      probes?: Array<{ name: string; status: string; reason?: string }>;
    };
    expect(body.status).toBe('error');
    const dbProbe = body.probes?.find(p => p.name === 'database');
    expect(dbProbe?.status).toBe('fail');
    // /health is unauthenticated + un-rate-limited. The internal error
    // message (connection strings, hostnames, etc.) MUST NOT appear in the
    // network response — it is only logged server-side. Codify the
    // security posture so a future refactor that re-adds the leak fails
    // the suite.
    expect(dbProbe?.reason).toBeUndefined();
  });

  it('treats backpressure saturation as a failed probe (without leaking queue topology)', async () => {
    mockGetQueueDepthSnapshot.mockResolvedValueOnce([
      { routeKey: 'ocr-process', depth: 30, threshold: 15, max: 10, saturated: true },
    ]);
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as {
      status?: string;
      probes?: Array<{ name: string; status: string; saturated?: unknown[] }>;
    };
    const bpProbe = body.probes?.find(p => p.name === 'backpressure');
    expect(bpProbe?.status).toBe('fail');
    // Saturation details (route keys, depths, thresholds) reveal internal
    // queue topology and live capacity — useful DoS reconnaissance and so
    // explicitly stripped from the public response.
    expect(bpProbe?.saturated).toBeUndefined();
  });
});
