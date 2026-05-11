import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Redis client — use vi.hoisted + a proper class mock
// ---------------------------------------------------------------------------

const { mockGet, mockSet, mockDel, mockScan } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn().mockResolvedValue('OK'),
  mockDel: vi.fn().mockResolvedValue(1),
  mockScan: vi.fn(),
}));

vi.mock('@upstash/redis', () => {
  // Must be a real class so `new Redis(...)` works
  class MockRedis {
    get = mockGet;
    set = mockSet;
    del = mockDel;
    scan = mockScan;
  }
  return { Redis: MockRedis };
});

// Set env vars before importing the module so the Redis client is created
process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

import { CacheKeys, CacheTTL, cached, cacheKey, invalidate, invalidateByPrefix } from '../cache';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// cacheKey
// ---------------------------------------------------------------------------

describe('cacheKey', () => {
  it('joins segments with colon and adds namespace prefix', () => {
    expect(cacheKey('org1', 'dash', 'kpis')).toBe('co:org1:dash:kpis');
  });

  it('handles single segment', () => {
    expect(cacheKey('solo')).toBe('co:solo');
  });
});

// ---------------------------------------------------------------------------
// CacheKeys
// ---------------------------------------------------------------------------

describe('CacheKeys', () => {
  const orgId = 'org_123';

  it('subscription key', () => {
    expect(CacheKeys.subscription(orgId)).toBe('co:org_123:billing:sub');
  });

  it('creditBalance key', () => {
    expect(CacheKeys.creditBalance(orgId)).toBe('co:org_123:billing:credits');
  });

  it('dashboardKpis key', () => {
    expect(CacheKeys.dashboardKpis(orgId)).toBe('co:org_123:dash:kpis');
  });

  it('dashboardSpend key includes months', () => {
    expect(CacheKeys.dashboardSpend(orgId, '6')).toBe('co:org_123:dash:spend:6');
  });

  it('dashboardDeadlines key', () => {
    expect(CacheKeys.dashboardDeadlines(orgId)).toBe('co:org_123:dash:deadlines');
  });

  it('dashboardActivity key', () => {
    expect(CacheKeys.dashboardActivity(orgId)).toBe('co:org_123:dash:activity');
  });

  it('orgSettings key', () => {
    expect(CacheKeys.orgSettings(orgId)).toBe('co:org_123:settings:org');
  });

  it('orgSettingsJson key includes sub-key', () => {
    expect(CacheKeys.orgSettingsJson(orgId, 'invoice')).toBe('co:org_123:settings:json:invoice');
  });

  it('orgBranding key', () => {
    expect(CacheKeys.orgBranding(orgId)).toBe('co:org_123:settings:branding');
  });

  it('approvalChains key', () => {
    expect(CacheKeys.approvalChains(orgId)).toBe('co:org_123:approval:chains');
  });

  it('dashboardPrefix for broad invalidation', () => {
    expect(CacheKeys.dashboardPrefix(orgId)).toBe('co:org_123:dash');
  });

  it('settingsPrefix for broad invalidation', () => {
    expect(CacheKeys.settingsPrefix(orgId)).toBe('co:org_123:settings');
  });

  it('billingPrefix for broad invalidation', () => {
    expect(CacheKeys.billingPrefix(orgId)).toBe('co:org_123:billing');
  });
});

// ---------------------------------------------------------------------------
// CacheTTL
// ---------------------------------------------------------------------------

describe('CacheTTL', () => {
  it('SUBSCRIPTION is 15 minutes', () => {
    expect(CacheTTL.SUBSCRIPTION).toBe(900);
  });

  it('CREDIT_BALANCE is 5 minutes', () => {
    expect(CacheTTL.CREDIT_BALANCE).toBe(300);
  });

  it('DASHBOARD_KPIS is 5 minutes', () => {
    expect(CacheTTL.DASHBOARD_KPIS).toBe(300);
  });

  it('DASHBOARD_SPEND is 10 minutes', () => {
    expect(CacheTTL.DASHBOARD_SPEND).toBe(600);
  });

  it('DASHBOARD_DEADLINES is 3 minutes', () => {
    expect(CacheTTL.DASHBOARD_DEADLINES).toBe(180);
  });

  it('DASHBOARD_ACTIVITY is 2 minutes', () => {
    expect(CacheTTL.DASHBOARD_ACTIVITY).toBe(120);
  });

  it('ORG_SETTINGS is 15 minutes', () => {
    expect(CacheTTL.ORG_SETTINGS).toBe(900);
  });

  it('ORG_SETTINGS_JSON is 30 minutes', () => {
    expect(CacheTTL.ORG_SETTINGS_JSON).toBe(1800);
  });

  it('ORG_BRANDING is 30 minutes', () => {
    expect(CacheTTL.ORG_BRANDING).toBe(1800);
  });

  it('APPROVAL_CHAINS is 10 minutes', () => {
    expect(CacheTTL.APPROVAL_CHAINS).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// cached()
// ---------------------------------------------------------------------------

describe('cached', () => {
  it('returns cached value on cache hit (envelope unwrapped)', async () => {
    mockGet.mockResolvedValueOnce({ __co_v: { id: 1, name: 'cached' } });

    const fn = vi.fn().mockResolvedValue({ id: 1, name: 'fresh' });
    const result = await cached('test-key', 300, fn);

    expect(result).toEqual({ id: 1, name: 'cached' });
    expect(fn).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith('test-key');
  });

  it('calls fn and stores result on cache miss', async () => {
    mockGet.mockResolvedValueOnce(null);
    const fn = vi.fn().mockResolvedValue({ id: 2, name: 'fresh' });

    const result = await cached('miss-key', 600, fn);

    expect(result).toEqual({ id: 2, name: 'fresh' });
    expect(fn).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith(
      'miss-key',
      { __co_v: { id: 2, name: 'fresh' } },
      { ex: 600 },
    );
  });

  it('properly caches null values using envelope', async () => {
    mockGet.mockResolvedValueOnce({ __co_v: null });

    const fn = vi.fn().mockResolvedValue('should not call');
    const result = await cached('null-key', 300, fn);

    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('falls back to fn when Redis GET fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Redis down'));
    const fn = vi.fn().mockResolvedValue('fallback-value');

    const result = await cached('error-key', 300, fn);

    expect(result).toBe('fallback-value');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not throw when Redis SET fails (fire-and-forget)', async () => {
    mockGet.mockResolvedValueOnce(null);
    mockSet.mockRejectedValueOnce(new Error('Redis SET failed'));

    const fn = vi.fn().mockResolvedValue('value');
    const result = await cached('set-fail-key', 300, fn);

    expect(result).toBe('value');
  });
});

// ---------------------------------------------------------------------------
// invalidate()
// ---------------------------------------------------------------------------

describe('invalidate', () => {
  it('deletes specified keys', async () => {
    await invalidate('key1', 'key2');
    expect(mockDel).toHaveBeenCalledWith('key1', 'key2');
  });

  it('does nothing when no keys provided', async () => {
    await invalidate();
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('does not throw when Redis DEL fails', async () => {
    mockDel.mockRejectedValueOnce(new Error('Redis DEL failed'));
    await expect(invalidate('fail-key')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// invalidateByPrefix()
// ---------------------------------------------------------------------------

describe('invalidateByPrefix', () => {
  it('scans and deletes all keys matching prefix', async () => {
    mockScan.mockResolvedValueOnce(['0', ['co:org1:dash:kpis', 'co:org1:dash:spend:6']]);

    await invalidateByPrefix('co:org1:dash');

    expect(mockScan).toHaveBeenCalledWith(0, {
      match: 'co:org1:dash*',
      count: 100,
    });
    expect(mockDel).toHaveBeenCalledWith('co:org1:dash:kpis', 'co:org1:dash:spend:6');
  });

  it('paginates through multiple scan pages', async () => {
    mockScan.mockResolvedValueOnce(['42', ['key1']]).mockResolvedValueOnce(['0', ['key2']]);

    await invalidateByPrefix('prefix');

    expect(mockScan).toHaveBeenCalledTimes(2);
    expect(mockDel).toHaveBeenCalledTimes(2);
  });

  it('does not throw when Redis scan fails', async () => {
    mockScan.mockRejectedValueOnce(new Error('SCAN failed'));
    await expect(invalidateByPrefix('fail-prefix')).resolves.toBeUndefined();
  });

  it('skips DEL when scan returns empty keys', async () => {
    mockScan.mockResolvedValueOnce(['0', []]);

    await invalidateByPrefix('empty-prefix');

    expect(mockDel).not.toHaveBeenCalled();
  });
});
