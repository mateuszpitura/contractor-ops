/**
 * Smoke tests for the Step 2 security baseline.
 *
 * Asserts the headers + status codes a regression in CSP / CORS / HSTS /
 * rate-limit posture would change. Uses `app.inject()` so no socket is
 * opened — fast enough to run on every commit.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

const TEST_ENV = {
  NODE_ENV: 'test',
  APP_URL: 'https://app.example.test',
  API_URL: 'https://api.example.test',
  PORT: '4000',
  HOST: '127.0.0.1',
  TRUSTED_PROXIES: 'loopback,linklocal,uniquelocal',
  HEALTH_TIMEOUT_MS: '1000',
} as const;

let app: FastifyInstance;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
  for (const [k, v] of Object.entries(TEST_ENV)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  __resetEnvForTests();
});

describe('security baseline', () => {
  it('returns 200 + x-request-id on /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(JSON.parse(res.body)).toMatchObject({ ok: true, service: 'api-server' });
  });

  it('honors inbound x-request-id', async () => {
    const id = 'caller-supplied-id-123';
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': id },
    });
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('emits CSP, HSTS, COOP, CORP, frame-ancestors, Permissions-Policy', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['strict-transport-security']).toContain('max-age=63072000');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['permissions-policy']).toContain('camera=()');
  });

  it('CORS preflight allows the configured origin', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        Origin: 'https://app.example.test',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.test');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-max-age']).toBe('86400');
  });

  it('CORS preflight rejects a non-allowlisted origin', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'GET',
      },
    });
    // @fastify/cors returns 200 with no Access-Control-Allow-Origin when the
    // origin callback rejects — the browser then blocks the request. We
    // assert the absence of the header (not a 403) to match the plugin.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate-limit headers are present on every API response', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/some-future-route' });
    // Route is unimplemented → 404, but the preHandler runs before route
    // resolution so X-RateLimit-* must be set.
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });
});
