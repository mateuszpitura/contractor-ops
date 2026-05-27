/** @vitest-environment node */

/**
 * Pins for the `/portal/set-session` + `/portal/clear-session` contract.
 *
 * Both routes are CSRF-exempt via the `/portal/` prefix in
 * `apps/api/src/plugins/csrf-origin.ts`. `set-session` therefore
 * relies on the HMAC signature minted by the originating tRPC
 * mutation (`portal.verifyMagicLink` / `portal.selectOrg`) — without
 * it, an attacker could plant any body-supplied token as the portal
 * cookie, opening a session-fixation primitive.
 *
 * Pinned branches:
 *   1. set-session — invalid body Zod shape → 400.
 *   2. set-session — missing signature → 400 (Zod rejects).
 *   3. set-session — wrong-secret signature → 401.
 *   4. set-session — truncated signature (length mismatch) → 401
 *      (must NOT throw — `timingSafeEqual` aborts on length mismatch
 *      and the route's pre-check returns false).
 *   5. set-session — valid signature → 200 + portal_session cookie
 *      with HttpOnly + Secure + SameSite=Strict attributes.
 *   6. clear-session — no cookie → 200, deletePortalSession NOT called.
 *   7. clear-session — cookie present → 200, deletePortalSession
 *      called with the token, cookie cleared with `Expires` in the
 *      past + `Max-Age=0`.
 *   8. clear-session — deletePortalSession throws → still returns 200
 *      + clears the cookie (best-effort cleanup; never propagates).
 */

import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { deletePortalSessionSpy } = vi.hoisted(() => ({
  deletePortalSessionSpy: vi.fn(),
}));

vi.mock('@contractor-ops/api/services/portal-session', () => ({
  deletePortalSession: deletePortalSessionSpy,
}));

import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

// The portal-session route reads `BETTER_AUTH_SECRET` via the validators
// package's cached `getServerEnv()`, which freezes the value at the
// `validateServerEnv` call that fires during `buildServer()`. Sign with
// whatever the test runtime's `process.env.BETTER_AUTH_SECRET` resolves
// to at that moment (loaded by dotenv-cli from the root `.env`) so the
// signature matches what the route's `expectedSignature` produces.
let Secret = '';

function signPortalToken(token: string, expiresAt: string): string {
  return createHmac('sha256', `${Secret}|portal-set-session-v1`)
    .update(`${token}.${expiresAt}`)
    .digest('base64url');
}

let app: FastifyInstance;

beforeAll(async () => {
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
  Secret = process.env.BETTER_AUTH_SECRET ?? '';
  if (!Secret) {
    throw new Error('portal-session.test.ts requires BETTER_AUTH_SECRET in the test env');
  }
});

afterAll(async () => {
  await app.close();
  __resetEnvForTests();
});

beforeEach(() => {
  deletePortalSessionSpy.mockReset();
});

const VALID_TOKEN = 'portal-token-abc';
const VALID_EXPIRES = new Date(Date.now() + 60_000).toISOString();

describe('POST /portal/set-session', () => {
  it('rejects 400 on an empty body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/portal/set-session',
      headers: {
        'content-type': 'application/json',
        origin: process.env.APP_URL ?? 'http://localhost:3000',
      },
      payload: '{}',
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects 400 when the signature field is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/portal/set-session',
      headers: {
        'content-type': 'application/json',
        origin: process.env.APP_URL ?? 'http://localhost:3000',
      },
      payload: JSON.stringify({ token: VALID_TOKEN, expiresAt: VALID_EXPIRES }),
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects 401 when the signature was minted with a different secret', async () => {
    const wrong = createHmac('sha256', 'other-secret|portal-set-session-v1')
      .update(`${VALID_TOKEN}.${VALID_EXPIRES}`)
      .digest('base64url');
    const res = await app.inject({
      method: 'POST',
      url: '/portal/set-session',
      headers: {
        'content-type': 'application/json',
        origin: process.env.APP_URL ?? 'http://localhost:3000',
      },
      payload: JSON.stringify({
        token: VALID_TOKEN,
        expiresAt: VALID_EXPIRES,
        signature: wrong,
      }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects 401 when the signature length differs from the expected digest', async () => {
    const truncated = signPortalToken(VALID_TOKEN, VALID_EXPIRES).slice(0, 10);
    const res = await app.inject({
      method: 'POST',
      url: '/portal/set-session',
      headers: {
        'content-type': 'application/json',
        origin: process.env.APP_URL ?? 'http://localhost:3000',
      },
      payload: JSON.stringify({
        token: VALID_TOKEN,
        expiresAt: VALID_EXPIRES,
        signature: truncated,
      }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a valid signature + sets HttpOnly/Secure/SameSite=Strict portal_session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/portal/set-session',
      headers: {
        'content-type': 'application/json',
        origin: process.env.APP_URL ?? 'http://localhost:3000',
      },
      payload: JSON.stringify({
        token: VALID_TOKEN,
        expiresAt: VALID_EXPIRES,
        signature: signPortalToken(VALID_TOKEN, VALID_EXPIRES),
      }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookie = Array.isArray(setCookie) ? setCookie.join('\n') : (setCookie as string);
    expect(cookie).toMatch(/portal_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\//i);
  });
});

describe('POST /portal/clear-session', () => {
  it('returns 200 + clears cookie when no portal_session cookie is present (no DB call)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/portal/clear-session',
      headers: { origin: process.env.APP_URL ?? 'http://localhost:3000' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(deletePortalSessionSpy).not.toHaveBeenCalled();
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('\n') : (setCookie as string);
    expect(cookie).toMatch(/portal_session=/);
    // A clear-cookie response has either Max-Age=0 or an Expires in the past.
    expect(cookie).toMatch(/Max-Age=0|Expires=/i);
  });

  it('calls deletePortalSession with the cookie token + clears the cookie', async () => {
    deletePortalSessionSpy.mockResolvedValue(undefined);
    const res = await app.inject({
      method: 'POST',
      url: '/portal/clear-session',
      headers: { origin: process.env.APP_URL ?? 'http://localhost:3000' },
      cookies: { portal_session: 'token-from-cookie' },
    });
    expect(res.statusCode).toBe(200);
    expect(deletePortalSessionSpy).toHaveBeenCalledTimes(1);
    expect(deletePortalSessionSpy).toHaveBeenCalledWith('token-from-cookie');
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('\n') : (setCookie as string);
    expect(cookie).toMatch(/Max-Age=0|Expires=/i);
  });

  it('still returns 200 + clears the cookie when deletePortalSession throws (best-effort cleanup)', async () => {
    deletePortalSessionSpy.mockRejectedValue(new Error('DB unreachable'));
    const res = await app.inject({
      method: 'POST',
      url: '/portal/clear-session',
      headers: { origin: process.env.APP_URL ?? 'http://localhost:3000' },
      cookies: { portal_session: 'token-from-cookie' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('\n') : (setCookie as string);
    expect(cookie).toMatch(/Max-Age=0|Expires=/i);
  });
});
