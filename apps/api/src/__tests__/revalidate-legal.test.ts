/** @vitest-environment node */

/**
 * Pins for the `/revalidate-legal` webhook contract — HMAC-SHA256
 * signature over the raw body with `CMS_WEBHOOK_SECRET`. The CMS
 * publisher (Payload) posts cache-invalidation requests without an
 * Origin header so the route is CSRF-exempt; the HMAC IS the authn.
 *
 * Six pinned branches:
 *   1. Missing signature header → 401.
 *   2. Wrong-secret signature → 401.
 *   3. Valid signature + valid payload → 200 with `{ ok: true, tag }`.
 *   4. Valid signature + missing required fields → 400 with
 *      `missing_fields`.
 *   5. Valid signature + invalid JSON → 400 with `bad_json`.
 *   6. Signature with mismatched length → 401 (must NOT throw —
 *      `timingSafeEqual` aborts on length mismatch and the route's
 *      pre-check returns false).
 */

import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

const SECRET = 'whsec_cms_test_secret';

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
}

let app: FastifyInstance;

beforeAll(async () => {
  process.env.CMS_WEBHOOK_SECRET = SECRET;
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  delete process.env.CMS_WEBHOOK_SECRET;
  __resetEnvForTests();
});

beforeEach(() => {
  // Each test owns its own request body + signature; no shared mock state.
});

describe('POST /revalidate-legal — CMS webhook signature contract', () => {
  it('rejects 401 when the x-cms-signature header is missing', async () => {
    const body = JSON.stringify({ type: 'privacy', jurisdiction: 'DE' });
    const res = await app.inject({
      method: 'POST',
      url: '/revalidate-legal',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ ok: false, reason: 'bad_signature' });
  });

  it('rejects 401 when the signature was computed with a different secret', async () => {
    const body = JSON.stringify({ type: 'privacy', jurisdiction: 'DE' });
    const wrong = createHmac('sha256', 'whsec_other_secret').update(body, 'utf8').digest('hex');
    const res = await app.inject({
      method: 'POST',
      url: '/revalidate-legal',
      headers: {
        'content-type': 'application/json',
        'x-cms-signature': wrong,
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects 401 when the signature length differs from the expected hex digest', async () => {
    // 32-char truncated signature — different length than the 64-char
    // SHA-256 hex digest. The route's pre-check on Buffer length must
    // refuse the request without calling timingSafeEqual (which would
    // throw on a length mismatch).
    const body = JSON.stringify({ type: 'privacy', jurisdiction: 'DE' });
    const truncated = sign(body).slice(0, 32);
    const res = await app.inject({
      method: 'POST',
      url: '/revalidate-legal',
      headers: {
        'content-type': 'application/json',
        'x-cms-signature': truncated,
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a correctly-signed payload + returns the invalidation tag', async () => {
    const body = JSON.stringify({ type: 'privacy', jurisdiction: 'DE', locale: 'de' });
    const res = await app.inject({
      method: 'POST',
      url: '/revalidate-legal',
      headers: {
        'content-type': 'application/json',
        'x-cms-signature': sign(body),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tag: 'legal:privacy:DE' });
  });

  it('rejects 400 when a signed payload is missing the type field', async () => {
    const body = JSON.stringify({ jurisdiction: 'DE' });
    const res = await app.inject({
      method: 'POST',
      url: '/revalidate-legal',
      headers: {
        'content-type': 'application/json',
        'x-cms-signature': sign(body),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ ok: false, reason: 'missing_fields' });
  });

  it('rejects 400 when a signed payload is not valid JSON', async () => {
    const body = 'definitely-not-json';
    const res = await app.inject({
      method: 'POST',
      url: '/revalidate-legal',
      headers: {
        'content-type': 'application/json',
        'x-cms-signature': sign(body),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ ok: false, reason: 'bad_json' });
  });
});
