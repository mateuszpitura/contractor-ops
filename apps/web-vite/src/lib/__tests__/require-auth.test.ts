/**
 * Regression tests for GAP-MIDDLEWARE-007 — `requireAuth` must preserve
 * the original destination as `?redirectTo=…` on the unauth bounce so
 * deep-links (bookmarks, email-notification links, share URLs) survive
 * the round-trip through the login page.
 *
 * Pins:
 *   - With a `request` argument carrying `/pl/contractors/123`, the
 *     redirect Response targets `/pl/login?redirectTo=%2Fcontractors%2F123`.
 *   - Query string on the original URL is preserved through the
 *     percent-encoded `redirectTo` value.
 *   - Bouncing from the locale root (`/pl`) emits a bare `/pl/login`
 *     (no clutter — round-tripping `/` adds zero value).
 *   - Bouncing without any `request` argument still works (backward
 *     compat with callers that don't yet pass it through).
 *   - Anonymous-or-missing-locale fallback still routes to
 *     `/{DEFAULT_LOCALE}/login`.
 *   - Authenticated session resolves to `null` (loader chain continues).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionSpy } = vi.hoisted(() => ({ getSessionSpy: vi.fn() }));

vi.mock('../../providers/auth-provider.js', () => ({
  getAuthClient: () => ({ getSession: getSessionSpy }),
}));

import { requireAuth } from '../require-auth.js';

function asReq(url: string): Request {
  return new Request(url);
}

async function expectRedirect(promise: Promise<unknown>): Promise<Response> {
  try {
    await promise;
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
  throw new Error('expected requireAuth to throw a redirect Response');
}

describe('requireAuth — GAP-MIDDLEWARE-007 regression', () => {
  beforeEach(() => {
    getSessionSpy.mockReset();
  });

  it('returns null when session exists — loader chain continues', async () => {
    getSessionSpy.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    const result = await requireAuth('pl', asReq('https://app.contractor-ops.test/pl/contractors'));
    expect(result).toBeNull();
  });

  it('appends ?redirectTo=… preserving the path under the locale prefix', async () => {
    getSessionSpy.mockResolvedValue({ data: null });
    const res = await expectRedirect(
      requireAuth('pl', asReq('https://app.contractor-ops.test/pl/contractors/123')),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/pl/login?redirectTo=%2Fcontractors%2F123');
  });

  it('preserves the query string on the original URL through redirectTo', async () => {
    getSessionSpy.mockResolvedValue({ data: null });
    const res = await expectRedirect(
      requireAuth('de', asReq('https://app.contractor-ops.test/de/invoices?status=overdue&page=2')),
    );
    expect(res.headers.get('Location')).toBe(
      '/de/login?redirectTo=%2Finvoices%3Fstatus%3Doverdue%26page%3D2',
    );
  });

  it('omits ?redirectTo when bouncing from the locale root', async () => {
    getSessionSpy.mockResolvedValue({ data: null });
    const res = await expectRedirect(
      requireAuth('en', asReq('https://app.contractor-ops.test/en')),
    );
    expect(res.headers.get('Location')).toBe('/en/login');
  });

  it('falls back to bare /{locale}/login when no request is supplied (backward compat)', async () => {
    getSessionSpy.mockResolvedValue({ data: null });
    const res = await expectRedirect(requireAuth('en'));
    expect(res.headers.get('Location')).toBe('/en/login');
  });

  it('uses DEFAULT_LOCALE (`pl`) when the URL :locale param is unsupported', async () => {
    getSessionSpy.mockResolvedValue({ data: null });
    const res = await expectRedirect(
      requireAuth('xx', asReq('https://app.contractor-ops.test/xx/contractors')),
    );
    expect(res.headers.get('Location')).toBe('/pl/login?redirectTo=%2Fxx%2Fcontractors');
  });
});
