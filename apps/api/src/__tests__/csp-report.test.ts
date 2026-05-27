/**
 * Regression tests for GAP-SECURITY-003 — SPA CSP reporting pipeline.
 *
 * The SPA's CSP (render.yaml + apps/web-vite/index.html) appends
 * `report-uri https://api.contractor-ops.com/csp-report; report-to csp-endpoint`
 * + a sibling `Report-To` header. The browser POSTs violation reports
 * cross-origin with NO Origin / Referer header, so the API must:
 *
 *   1. Accept the legacy `application/csp-report` content type.
 *   2. Accept the modern Reporting API v1 `application/reports+json` array.
 *   3. Skip the CSRF-origin guard for `/csp-report` (otherwise the report
 *      POST 403s and on-call loses XSS visibility).
 *   4. Return 204 with an empty body — non-success status triggers browser
 *      retries during a misconfigured CSP rollout.
 *
 * `utility-routes.test.ts` covers (1) + (2); this file owns (3) + (4)
 * explicitly so a future regression on `csrf-origin.ts:32` (removing the
 * exempt prefix) fails here with an obvious message.
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

describe('/csp-report — GAP-SECURITY-003 regression', () => {
  it('accepts legacy application/csp-report without an Origin header (CSRF guard exempt)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/csp-report',
      headers: { 'content-type': 'application/csp-report' },
      payload: JSON.stringify({
        'csp-report': {
          'document-uri': 'https://app.contractor-ops.com/en/dashboard',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.example/x.js',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
        },
      }),
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('accepts Reporting API v1 application/reports+json without an Origin header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/csp-report',
      headers: { 'content-type': 'application/reports+json' },
      payload: JSON.stringify([
        {
          type: 'csp-violation',
          age: 12,
          url: 'https://app.contractor-ops.com/en/contractors',
          user_agent: 'Mozilla/5.0 vitest',
          body: {
            'violated-directive': 'img-src',
            'blocked-uri': 'data:',
            disposition: 'enforce',
          },
        },
      ]),
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });

  it('still returns 204 when a hostile Origin is set (CSRF guard does not block reports)', async () => {
    // Simulates a browser that DOES attach an Origin during a redirect-chained
    // report POST — the exempt prefix in csrf-origin.ts must let it through.
    const res = await app.inject({
      method: 'POST',
      url: '/csp-report',
      headers: {
        'content-type': 'application/csp-report',
        origin: 'https://not-on-the-allowlist.example',
      },
      payload: JSON.stringify({
        'csp-report': {
          'document-uri': 'https://app.contractor-ops.com/',
          'violated-directive': 'connect-src',
          'blocked-uri': 'https://blocked.example/api',
        },
      }),
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });
});
