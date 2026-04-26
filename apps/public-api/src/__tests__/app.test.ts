/**
 * Integration tests for app.ts (top-level Hono app).
 *
 * Uses Hono's fetch-style harness — no supertest needed.
 * Routes are assembled for real; only tRPC callers are stubbed.
 *
 * Structure:
 *  - Most tests use a module-level `app` import (ENABLE_API_DOCS unset).
 *  - SRI-gating and docs-CSP tests use vi.resetModules() + dynamic import
 *    inside the test body so the env change is visible at module-load time.
 */

import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted stubs — defined before vi.mock() hoisting resolves them.
// ---------------------------------------------------------------------------

const { mockCallerStub } = vi.hoisted(() => {
  const mockCallerStub = {
    invoice: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
      getById: vi.fn(),
    },
    contract: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
      getById: vi.fn(),
    },
    contractor: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
      getById: vi.fn(),
    },
    document: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
      getDownloadUrl: vi.fn(),
    },
    featureFlags: { list: vi.fn().mockResolvedValue([]) },
  };
  return { mockCallerStub };
});

vi.mock('../lib/create-caller.js', () => ({
  createPublicCaller: vi.fn(() => mockCallerStub),
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

// ---------------------------------------------------------------------------
// Static import — ENABLE_API_DOCS not set, so no throw at load time.
// ---------------------------------------------------------------------------

import app from '../app.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_ORIGIN = 'https://app.contractor-ops.com';
const UNTRUSTED_ORIGIN = 'https://evil.example.com';

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe('Health check', () => {
  it('GET /api/v1/health returns 200 { status: "ok" }', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body).toEqual({ status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
// OpenAPI spec
// ---------------------------------------------------------------------------

describe('OpenAPI spec', () => {
  it('GET /api/v1/openapi.json returns 200 with the spec', async () => {
    const res = await app.request('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { openapi: string };
    expect(body.openapi).toBe('3.1.0');
  });

  it('openapi.json response has Content-Type application/json', async () => {
    const res = await app.request('/api/v1/openapi.json');
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});

// ---------------------------------------------------------------------------
// 404 handling
// ---------------------------------------------------------------------------

describe('404 handling', () => {
  it('unknown route returns 404', async () => {
    const res = await app.request('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('unknown route returns JSON error body with code=NOT_FOUND', async () => {
    const res = await app.request('/api/v1/does-not-exist');
    const body = (await res.json()) as { error: { code: string; status: number } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

describe('Security headers', () => {
  it('X-Frame-Options: DENY is set', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('X-Content-Type-Options: nosniff is set', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

// ---------------------------------------------------------------------------
// Request ID
// ---------------------------------------------------------------------------

describe('Request ID', () => {
  it('X-Request-Id header is present in response', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

describe('CORS', () => {
  it('OPTIONS from allowed origin returns Access-Control-Allow-Origin matching origin', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
  });

  it('OPTIONS from untrusted origin does NOT echo origin in ACAO', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'OPTIONS',
      headers: {
        Origin: UNTRUSTED_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const acao = res.headers.get('access-control-allow-origin');
    expect(acao).not.toBe(UNTRUSTED_ORIGIN);
  });

  it('exposeHeaders includes X-RateLimit-Limit', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const exposed = res.headers.get('access-control-expose-headers') ?? '';
    expect(exposed).toContain('X-RateLimit-Limit');
  });

  it('exposeHeaders includes Retry-After', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const exposed = res.headers.get('access-control-expose-headers') ?? '';
    expect(exposed).toContain('Retry-After');
  });
});

// ---------------------------------------------------------------------------
// /docs disabled by default
// ---------------------------------------------------------------------------

describe('/docs when ENABLE_API_DOCS is not set', () => {
  it('returns 404 for /docs when docs are disabled', async () => {
    const res = await app.request('/api/v1/docs');
    expect(res.status).toBe(404);
  });
});

// SRI gating and /docs CSP tests live in app-sri.test.ts which has no
// static app import and can therefore use vi.resetModules() + dynamic import
// to exercise different ENABLE_API_DOCS / SCALAR_SRI_HASH values at load time.
