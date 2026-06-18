/**
 * Pins for `hasPortalSessionCookie`. The helper short-circuits the
 * `portal.getSession` tRPC round-trip when the `portal_session` cookie
 * is missing or obviously malformed (too short, non-base64 charset).
 * The authoritative validation still happens server-side; this guard
 * only drives the unauthenticated-UX bounce to portal login.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hasPortalSessionCookie } from '../require-portal-auth.js';

const COOKIE_KEY = 'portal_session';

function setCookie(raw: string): void {
  // jsdom assigns each `document.cookie =` write into the cookie jar
  // independently. Clear by expiring before each test (see beforeEach).
  // biome-ignore lint/suspicious/noDocumentCookie: canonical cookie write — seeds the jsdom cookie jar so the helper-under-test can read it
  document.cookie = raw;
}

function clearCookies(): void {
  for (const entry of document.cookie.split(';')) {
    const name = entry.split('=')[0]?.trim();
    // biome-ignore lint/suspicious/noDocumentCookie: canonical cookie write — expires each jsdom cookie to reset state between tests
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

describe('hasPortalSessionCookie', () => {
  beforeEach(() => {
    clearCookies();
  });

  afterEach(() => {
    clearCookies();
  });

  it('returns false when no portal_session cookie is set', () => {
    expect(hasPortalSessionCookie()).toBe(false);
  });

  it('returns false on an empty portal_session value', () => {
    setCookie(`${COOKIE_KEY}=`);
    expect(hasPortalSessionCookie()).toBe(false);
  });

  it('returns false on an obviously-too-short value (length < 20)', () => {
    setCookie(`${COOKIE_KEY}=abc123`);
    expect(hasPortalSessionCookie()).toBe(false);
  });

  it('returns false on a value with disallowed characters (charset guard)', () => {
    // 25 chars but includes a space — not URL-safe-base64.
    setCookie(`${COOKIE_KEY}=aaaaaaaaaaaaaaaaaaaaaaa b`);
    expect(hasPortalSessionCookie()).toBe(false);
  });

  it('returns true on a plausible URL-safe-base64 token of sufficient length', () => {
    setCookie(`${COOKIE_KEY}=abcdefghijklmnopqrstu_v.w-xyz0123456789`);
    expect(hasPortalSessionCookie()).toBe(true);
  });

  it('ignores other cookies and only inspects the portal_session entry', () => {
    setCookie(`other=foo`);
    setCookie(`${COOKIE_KEY}=abcdefghijklmnopqrstu_v.w-xyz0123456789`);
    setCookie(`extra=bar`);
    expect(hasPortalSessionCookie()).toBe(true);
  });
});
