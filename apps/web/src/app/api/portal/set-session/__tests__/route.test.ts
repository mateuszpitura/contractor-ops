/** @vitest-environment node */

import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { POST } from '../route';

// F-SEC-09: route requires an HMAC signature minted by `verifyMagicLink` /
// `selectOrg`. We compute the same signature here using the same secret +
// label the route does so positive cases pass.

const TEST_SECRET = 'test-better-auth-secret-32-chars-minimum-length-ok-1234';

function sign(token: string, expiresAt: string): string {
  return createHmac('sha256', `${TEST_SECRET}|portal-set-session-v1`)
    .update(`${token}.${expiresAt}`)
    .digest('base64url');
}

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = TEST_SECRET;
});

describe('POST /api/portal/set-session', () => {
  it('returns 400 when body fails validation', async () => {
    const req = new NextRequest('http://localhost/api/portal/set-session', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 401 when signature is invalid (CSRF / fixation defence)', async () => {
    const expires = new Date('2099-01-01T00:00:00.000Z').toISOString();
    const req = new NextRequest('http://localhost/api/portal/set-session', {
      method: 'POST',
      body: JSON.stringify({
        token: 'sess-token-abc',
        expiresAt: expires,
        signature: 'not-a-real-signature',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 and sets portal_session cookie on valid signed input', async () => {
    const token = 'sess-token-abc';
    const expires = new Date('2099-01-01T00:00:00.000Z').toISOString();
    const signature = sign(token, expires);

    const req = new NextRequest('http://localhost/api/portal/set-session', {
      method: 'POST',
      body: JSON.stringify({ token, expiresAt: expires, signature }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('portal_session=sess-token-abc');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=strict');
    expect(setCookie.toLowerCase()).toContain('secure');
  });

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/portal/set-session', {
      method: 'POST',
      body: '{not-valid-json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe('Invalid request body');
  });
});
