// getImpactPreview cache + failure-classifier tests.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cached, invalidate, describeImpactGws, describeImpactSlack, resolveDeprovisionToken } =
  vi.hoisted(() => ({
    cached: vi.fn(),
    invalidate: vi.fn(async () => undefined),
    describeImpactGws: vi.fn(),
    describeImpactSlack: vi.fn(),
    resolveDeprovisionToken: vi.fn(async () => ({
      ok: true,
      accessToken: 'tok',
      connectionId: 'c1',
    })),
  }));

vi.mock('../services/cache', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/cache')>();
  const { createPassthroughCacheMock } = await import('../__tests__/__mocks__/cache-service');
  return createPassthroughCacheMock(actual, { cached, invalidate });
});
vi.mock('../services/idp-token-resolver', () => ({ resolveDeprovisionToken }));
vi.mock('@contractor-ops/integrations', async () => {
  const actual = await vi.importActual<typeof import('@contractor-ops/integrations')>(
    '@contractor-ops/integrations',
  );
  return {
    classifyError: actual.classifyError,
    createConfiguredDeprovisionableAdapter: (provider: 'GOOGLE_WORKSPACE' | 'SLACK') => ({
      describeImpact: provider === 'SLACK' ? describeImpactSlack : describeImpactGws,
    }),
  };
});
vi.mock('@contractor-ops/integrations/adapters/google-workspace-adapter', () => ({
  GoogleWorkspaceAdapter: class {
    withAccessToken() {
      return this;
    }
    describeImpact = describeImpactGws;
  },
}));
vi.mock('@contractor-ops/integrations/adapters/slack-adapter', () => ({
  SlackAdapter: class {
    withOrgGridToken() {
      return this;
    }
    describeImpact = vi.fn();
  },
}));

import { CacheKeys } from '../services/cache';
import { getImpactPreview } from '../services/idp-impact-preview';

const baseArgs = {
  db: {} as any,
  organizationId: 'org-1',
  provider: 'GOOGLE_WORKSPACE' as const,
  externalUserId: 'u@example.com',
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveDeprovisionToken.mockResolvedValue({ ok: true, accessToken: 'tok', connectionId: 'c1' });
});

describe('getImpactPreview (Phase 77 D-02/D-03)', () => {
  it('returns the cached preview on a cache hit (adapter not called by the service)', async () => {
    const preview = { provider: 'GOOGLE_WORKSPACE', commonMetrics: {}, customMetrics: {} };
    cached.mockResolvedValueOnce(preview);
    const result = await getImpactPreview(baseArgs);
    expect(result).toEqual({ ok: true, preview });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('forceRefresh invalidates the cache key first', async () => {
    cached.mockResolvedValueOnce({ provider: 'GOOGLE_WORKSPACE' });
    await getImpactPreview({ ...baseArgs, forceRefresh: true });
    expect(invalidate).toHaveBeenCalledWith(
      CacheKeys.idpPreview('org-1', 'GOOGLE_WORKSPACE', 'u@example.com'),
    );
  });

  it('reconnect_required when no connection token resolves', async () => {
    resolveDeprovisionToken.mockResolvedValueOnce({ ok: false, reason: 'not_connected' });
    const result = await getImpactPreview(baseArgs);
    expect(result).toEqual({ ok: false, kind: 'reconnect_required', reason: 'not_connected' });
  });

  it('401 adapter failure → reconnect_required', async () => {
    cached.mockImplementationOnce((_k, _t, fn) => fn());
    describeImpactGws.mockRejectedValueOnce(
      Object.assign(new Error('unauthorized'), { status: 401 }),
    );
    const result = await getImpactPreview(baseArgs);
    expect(result).toEqual({ ok: false, kind: 'reconnect_required', reason: 'auth_expired' });
  });

  it('429 adapter failure → admin_choice', async () => {
    cached.mockImplementationOnce((_k, _t, fn) => fn());
    describeImpactGws.mockRejectedValueOnce(
      Object.assign(new Error('rate limited'), { status: 429 }),
    );
    const result = await getImpactPreview(baseArgs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('admin_choice');
  });
});
