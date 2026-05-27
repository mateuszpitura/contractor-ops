/**
 * Regression tests for GAP-MIDDLEWARE-004 — restored "already-signed-in
 * user landing on /login bounces to dashboard" behavior.
 *
 * Pins:
 *   - When no session is present, `requireAnonymous` resolves to `null`
 *     (loader chain continues to render the auth page).
 *   - When a session is present, throws a `redirect` Response targeting
 *     the locale-aware dashboard root (or `redirectTo` deep-link).
 *   - Locale defaults to `DEFAULT_LOCALE` when the URL `:locale` param is
 *     missing or unsupported — mirrors `requireAuth.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionSpy } = vi.hoisted(() => ({ getSessionSpy: vi.fn() }));

vi.mock('../../providers/auth-provider.js', () => ({
  getAuthClient: () => ({ getSession: getSessionSpy }),
}));

import { requireAnonymous } from '../require-anonymous.js';

describe('requireAnonymous — GAP-MIDDLEWARE-004 regression', () => {
  beforeEach(() => {
    getSessionSpy.mockReset();
  });

  it('returns null when no session — auth page is allowed to render', async () => {
    getSessionSpy.mockResolvedValue({ data: null });
    const result = await requireAnonymous('en');
    expect(result).toBeNull();
  });

  it('throws redirect to /{locale} when session exists and no redirectTo', async () => {
    getSessionSpy.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    let thrown: unknown;
    try {
      await requireAnonymous('en');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Response);
    const res = thrown as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/en');
  });

  it('throws redirect to /{locale}{redirectTo} when redirectTo is provided', async () => {
    getSessionSpy.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    let thrown: unknown;
    try {
      await requireAnonymous('de', { redirectTo: '/invoices/intake' });
    } catch (err) {
      thrown = err;
    }
    const res = thrown as Response;
    expect(res.headers.get('Location')).toBe('/de/invoices/intake');
  });

  it('falls back to DEFAULT_LOCALE (`pl`) when the URL :locale param is unsupported', async () => {
    getSessionSpy.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    let thrown: unknown;
    try {
      await requireAnonymous('xx');
    } catch (err) {
      thrown = err;
    }
    const res = thrown as Response;
    expect(res.headers.get('Location')).toBe('/pl');
  });
});
