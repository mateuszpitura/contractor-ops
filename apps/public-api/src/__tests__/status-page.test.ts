/**
 * The public, unauthenticated `/status.json` aggregator maps the shipped health
 * sources into three coarse component states (api / webhooks-dispatcher /
 * background-jobs), exposes NO tenant data, renders incident history, and 404s
 * when `module.public-status-page` is off.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCallerStub, flagState } = vi.hoisted(() => ({
  mockCallerStub: {
    invoice: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }) },
    contract: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }) },
    contractor: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }) },
    document: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }) },
    featureFlags: { list: vi.fn().mockResolvedValue([]) },
  },
  flagState: { enabled: true },
}));

vi.mock('../lib/create-caller.js', () => ({ createPublicCaller: vi.fn(() => mockCallerStub) }));

vi.mock('@contractor-ops/feature-flags', () => ({
  evaluate: vi.fn(() => ({ enabled: flagState.enabled, reason: 'test' })),
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
  const loggerStub = { ...stub, child: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })) };
  return {
    logger: loggerStub,
    createTrpcLogger: vi.fn(() => stub),
    createLogger: vi.fn(() => loggerStub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

import app from '../app.js';

const COMPONENT_STATES = ['operational', 'degraded', 'down'];

/** Deep-scan for any tenant-identifying key or value — the no-leak invariant. */
function assertNoTenantData(value: unknown, path = '$'): void {
  const FORBIDDEN_KEYS = /organization|tenant|orgId|org_id|customer|userId|user_id|email/i;
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      assertNoTenantData(v, `${path}[${i}]`);
    });
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      expect(k, `${path}.${k} must not be a tenant field`).not.toMatch(FORBIDDEN_KEYS);
      assertNoTenantData(v, `${path}.${k}`);
    }
  }
}

beforeEach(() => {
  flagState.enabled = true;
});

describe('public /status.json aggregator', () => {
  it('returns the three coarse component states from the shipped health sources', async () => {
    const res = await app.request('/v1/status.json');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      updatedAt: string;
      components: Record<string, { status: string }>;
      incidents: unknown[];
    };
    expect(body.updatedAt).toBeTruthy();
    expect(Object.keys(body.components).sort()).toEqual(
      ['api', 'background-jobs', 'webhooks-dispatcher'].sort(),
    );
    for (const comp of Object.values(body.components)) {
      expect(COMPONENT_STATES).toContain(comp.status);
    }
    expect(Array.isArray(body.incidents)).toBe(true);
  });

  it('exposes NO tenant data / org id / raw probe internals', async () => {
    const res = await app.request('/v1/status.json');
    const body = await res.json();
    assertNoTenantData(body);
  });

  it('404s when module.public-status-page is off (ship-dark)', async () => {
    flagState.enabled = false;
    const res = await app.request('/v1/status.json');
    expect(res.status).toBe(404);
  });
});
