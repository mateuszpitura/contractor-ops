/**
 * Smoke tests for the Step 5 utility-route ports.
 *
 *   - /csp-report  — accepts legacy + Reporting API v1 shapes; returns 204.
 *   - /web-vitals  — accepts one metric per beacon; returns 204.
 *
 * Both routes are exempt from the CSRF origin guard (browsers emit the
 * POST without an Origin header), so the test asserts they return 204
 * even with no Origin set.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  __resetEnvForTests();
});

describe('/csp-report', () => {
  it('accepts a legacy Content-Type: application/csp-report payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/csp-report',
      headers: { 'content-type': 'application/csp-report' },
      payload: JSON.stringify({
        'csp-report': {
          'document-uri': 'https://app.example.test/login',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.example/script.js',
        },
      }),
    });
    expect(res.statusCode).toBe(204);
  });

  it('accepts a Reporting API v1 array payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/csp-report',
      headers: { 'content-type': 'application/reports+json' },
      payload: JSON.stringify([
        {
          type: 'csp-violation',
          url: 'https://app.example.test/',
          user_agent: 'test',
          body: { 'violated-directive': 'img-src', 'blocked-uri': 'data:' },
        },
      ]),
    });
    expect(res.statusCode).toBe(204);
  });

  it('returns 204 even on an unrecognised payload shape', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/csp-report',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ random: 'shape' }),
    });
    expect(res.statusCode).toBe(204);
  });
});

describe('/web-vitals', () => {
  it('accepts a single metric beacon', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/web-vitals',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        name: 'LCP',
        value: 1850,
        rating: 'good',
        delta: 1850,
        id: 'v3-1700000000000-1234',
        navigationType: 'navigate',
        locale: 'en',
        url: '/en/dashboard',
      }),
    });
    expect(res.statusCode).toBe(204);
  });

  it('returns 204 even on an invalid payload (no retry)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/web-vitals',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 42 }), // value type mismatch
    });
    expect(res.statusCode).toBe(204);
  });
});
