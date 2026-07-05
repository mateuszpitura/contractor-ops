/**
 * The developer portal EXTENDS the shipped Scalar `/docs` mount with sibling
 * pages (webhooks catalog, SDK guides, recipes, changelog, deprecations) + the
 * downloadable collections, all behind a default-off `module.developer-portal`
 * flag (404 when off). The Scalar OpenAPI reference stays unchanged.
 */

import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
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

const PORTAL_PAGES = [
  '/v1/docs/webhooks',
  '/v1/docs/sdks',
  '/v1/docs/recipes',
  '/v1/docs/changelog',
  '/v1/docs/deprecations',
];

beforeEach(() => {
  flagState.enabled = true;
});

describe('developer portal (module.developer-portal ON)', () => {
  it('serves every portal page', async () => {
    for (const page of PORTAL_PAGES) {
      const res = await app.request(page);
      expect(res.status, `${page} should serve when the flag is on`).toBe(200);
    }
  });

  it('renders the webhook event catalog from the shared source', async () => {
    const res = await app.request('/v1/docs/webhooks');
    const text = await res.text();
    for (const event of WEBHOOK_EVENT_TYPES) {
      expect(text).toContain(event);
    }
  });

  it('serves the generated collections for download', async () => {
    for (const path of ['/v1/collections/postman.json', '/v1/collections/insomnia.json']) {
      const res = await app.request(path);
      expect(res.status, `${path} should be downloadable`).toBe(200);
    }
  });

  it('leaves the Scalar OpenAPI reference (/v1/docs) unchanged', async () => {
    const res = await app.request('/v1/docs');
    expect(res.status).toBe(200);
  });
});

describe('developer portal (module.developer-portal OFF — ship-dark)', () => {
  it('404s every portal page + collection route', async () => {
    flagState.enabled = false;
    for (const page of [...PORTAL_PAGES, '/v1/collections/postman.json']) {
      const res = await app.request(page);
      expect(res.status, `${page} should 404 when the flag is off`).toBe(404);
    }
  });
});
