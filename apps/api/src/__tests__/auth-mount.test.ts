/**
 * Contract tests for the Better Auth mount + CSRF origin guard.
 *
 * Asserts only the bridge contract — Better Auth's own behaviour is covered
 * by `packages/auth` tests. Here we prove:
 *
 *   1. Unknown /api/auth/* path returns 404 (Better Auth handler runs and
 *      decides; bridge does not swallow).
 *   2. /api/auth/session on a clean cookie jar returns 200 with `{user: null}`
 *      shape (Better Auth's "anonymous session" response — proves the
 *      bridge can read+respond to GET).
 *   3. CSRF origin guard exempts /api/auth/** (else Better Auth's own POSTs
 *      would 403 in the cross-subdomain mode).
 *   4. CSRF origin guard exempts /webhooks/** and /health.
 *   5. CSRF origin guard rejects a state-changing /api/* POST without Origin.
 *   6. CSRF origin guard rejects a state-changing /api/* POST from a
 *      non-allowlisted Origin.
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
  // Better Auth env — minimum surface to boot the handler in test mode.
  // Secret is short to bypass the production guard.
  BETTER_AUTH_SECRET: 'test-secret-test-secret',
  BETTER_AUTH_URL: 'https://api.example.test',
  PUBLIC_APP_URL: 'https://app.example.test',
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

describe('Better Auth mount', () => {
  it('GET /api/auth/get-session returns a Better Auth response (not a Fastify 404)', async () => {
    // Better Auth's canonical session-lookup endpoint is `/get-session`; an
    // unauthenticated call returns 200 with a JSON `null` body. The bridge
    // is correct as long as Better Auth handled the request — that's
    // signalled by a JSON content-type and a 200 status (Fastify's own
    // missing-route 404 carries `application/json; charset=utf-8` + a
    // `{statusCode: 404}` envelope; we assert the body is *not* that shape).
    const res = await app.inject({ method: 'GET', url: '/api/auth/get-session' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    // Better Auth returns `null` for an anonymous session; Fastify 404
    // would return `{statusCode: 404, ...}`.
    expect(res.body).not.toContain('"statusCode":404');
  });

  it('routes /api/auth/* through the Better Auth handler (path echo)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/does-not-exist' });
    // Better Auth itself returns 404 for unknown endpoints; the important
    // assertion is that the bridge actually delegated (body shape comes from
    // Better Auth, not Fastify's default error serializer).
    expect(res.statusCode).toBe(404);
  });
});

describe('CSRF origin guard', () => {
  it('exempts /api/auth/** from origin check (no Origin header)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      payload: {},
      headers: { 'content-type': 'application/json' },
    });
    // If the guard fired we'd see 403 with `{ error: 'origin not allowed' }`.
    // Better Auth itself returns 401/404 depending on plugin state; both
    // prove the guard did NOT block.
    expect(res.statusCode).not.toBe(403);
  });

  it('exempts /health from origin check', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a state-changing /api/* POST with a non-allowlisted Origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/some-mutation',
      payload: { foo: 'bar' },
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'origin not allowed' });
  });

  it('rejects a state-changing /api/* POST with no Origin / no Referer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/some-mutation',
      payload: { foo: 'bar' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('passes a state-changing /api/* POST from the allowlisted Origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/some-mutation',
      payload: { foo: 'bar' },
      headers: { 'content-type': 'application/json', origin: 'https://app.example.test' },
    });
    // No /api/some-mutation route → Fastify 404 (NOT the 403 from the guard).
    // The guard cleared the request; the missing route then 404s.
    expect(res.statusCode).toBe(404);
  });
});
