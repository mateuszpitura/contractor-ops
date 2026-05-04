/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// F-OBS-07 — the health route now runs four real probes (DB, Upstash Redis,
// Upstash QStash, Cloudflare R2) inside a `Promise.allSettled` wrapped in a
// 5s overall timeout. Each probe is gated on its own env vars and reported as
// `skipped` when unconfigured. The tests below mock each probe's transport so
// we can drive the all-pass path AND a per-probe failure path deterministically
// without hitting any network.

const { mockQueryRaw, mockRedisPing, mockS3Send } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockRedisPing: vi.fn(),
  mockS3Send: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('@upstash/redis', () => ({
  // Better Auth's Upstash Redis client is `new`-able. Use a class so vitest's
  // call-tracking heuristics don't trip on the bare `vi.fn()` constructor
  // pattern (which logs a noisy warning).
  Redis: class {
    ping(): Promise<unknown> {
      return mockRedisPing();
    }
  },
}));

vi.mock('@aws-sdk/client-s3', () => {
  class HeadObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class S3Client {
    send(command: HeadObjectCommand) {
      return mockS3Send(command);
    }
  }
  return { S3Client, HeadObjectCommand };
});

interface ProbeResult {
  name: 'database' | 'redis' | 'qstash' | 'r2';
  status: 'ok' | 'fail' | 'skipped';
  durationMs: number;
  reason?: string;
}

interface HealthBody {
  status: 'ok' | 'error';
  timestamp: string;
  durationMs: number;
  probes: ProbeResult[];
}

const ORIGINAL_ENV = { ...process.env };
let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

function configureAllProbes() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token';
  process.env.QSTASH_TOKEN = 'qstash-token';
  process.env.QSTASH_HEALTH_URL = 'https://qstash.upstash.io';
  process.env.R2_ACCOUNT_ID = 'acct-1';
  process.env.R2_ACCESS_KEY_ID = 'access-1';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-1';
  process.env.R2_BUCKET_NAME = 'bucket-1';
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedisPing.mockResolvedValue('PONG');
    mockS3Send.mockResolvedValue({});
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      // Upstash QStash typically returns 405 to HEAD; the route treats that as
      // reachable. Use 200 here to keep the happy path obvious.
      new Response(null, { status: 200 }),
    );
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    fetchSpy?.mockRestore();
  });

  it('returns 200 ok when only the database probe is configured (others skipped)', async () => {
    // Strip optional env vars so redis/qstash/r2 short-circuit to `skipped`.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.QSTASH_TOKEN;
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_BUCKET_NAME_EU;

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(200);

    const json = (await res.json()) as HealthBody;
    expect(json.status).toBe('ok');
    expect(json.timestamp).toMatch(/^\d{4}-/);
    expect(mockQueryRaw).toHaveBeenCalled();

    const byName = Object.fromEntries(json.probes.map(p => [p.name, p.status]));
    expect(byName).toEqual({
      database: 'ok',
      redis: 'skipped',
      qstash: 'skipped',
      r2: 'skipped',
    });
  });

  it('returns 200 ok when every configured probe succeeds', async () => {
    configureAllProbes();

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(200);

    const json = (await res.json()) as HealthBody;
    expect(json.status).toBe('ok');
    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockRedisPing).toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://qstash.upstash.io',
      expect.objectContaining({ method: 'HEAD' }),
    );
    expect(mockS3Send).toHaveBeenCalled();

    const byName = Object.fromEntries(json.probes.map(p => [p.name, p.status]));
    expect(byName).toEqual({
      database: 'ok',
      redis: 'ok',
      qstash: 'ok',
      r2: 'ok',
    });
  });

  it('returns 503 with diagnostic JSON when the database probe fails', async () => {
    configureAllProbes();
    mockQueryRaw.mockRejectedValueOnce(new Error('db down'));

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(503);

    const json = (await res.json()) as HealthBody;
    expect(json.status).toBe('error');
    const dbProbe = json.probes.find(p => p.name === 'database');
    expect(dbProbe?.status).toBe('fail');
    expect(dbProbe?.reason).toContain('db down');
    // Non-failing probes still report their individual status so on-call has
    // a full picture from a single response.
    expect(json.probes.find(p => p.name === 'redis')?.status).toBe('ok');
  });

  it('treats an R2 NotFound on the canary key as ok (auth + connectivity proven)', async () => {
    configureAllProbes();
    const notFound = Object.assign(new Error('not found'), { name: 'NotFound' });
    mockS3Send.mockRejectedValueOnce(notFound);

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(200);

    const json = (await res.json()) as HealthBody;
    expect(json.probes.find(p => p.name === 'r2')?.status).toBe('ok');
  });
});
