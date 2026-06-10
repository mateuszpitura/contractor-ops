import { describe, expect, it } from 'vitest';
import type { ErrorClass } from '../idp/error-classifier.js';
import { classifyError } from '../idp/error-classifier.js';

describe('classifyError (closed-enum classifier)', () => {
  it('maps 429 to TRANSIENT_RATE_LIMIT', () => {
    expect(classifyError({ httpStatus: 429 })).toBe('TRANSIENT_RATE_LIMIT');
  });

  it('maps 503 to TRANSIENT_RATE_LIMIT', () => {
    expect(classifyError({ httpStatus: 503 })).toBe('TRANSIENT_RATE_LIMIT');
  });

  it('maps a network-level cause to TRANSIENT_NETWORK', () => {
    const econnreset = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    expect(classifyError({ cause: econnreset })).toBe('TRANSIENT_NETWORK');
    expect(classifyError({ cause: new Error('fetch failed') })).toBe('TRANSIENT_NETWORK');
  });

  it('unwraps a Node fetch wrapper cause to detect ETIMEDOUT', () => {
    const wrapped = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }),
    });
    expect(classifyError({ cause: wrapped })).toBe('TRANSIENT_NETWORK');
  });

  it('maps 404 to PERMANENT_NOT_FOUND', () => {
    expect(classifyError({ httpStatus: 404 })).toBe('PERMANENT_NOT_FOUND');
  });

  it('maps 401 to PERMANENT_AUTH_EXPIRED', () => {
    expect(classifyError({ httpStatus: 401 })).toBe('PERMANENT_AUTH_EXPIRED');
  });

  it('maps 403 to PERMANENT_FORBIDDEN', () => {
    expect(classifyError({ httpStatus: 403 })).toBe('PERMANENT_FORBIDDEN');
  });

  it('maps Slack cannot_perform_operation to PERMANENT_FORBIDDEN regardless of status', () => {
    expect(classifyError({ httpStatus: 403, providerErrorCode: 'cannot_perform_operation' })).toBe(
      'PERMANENT_FORBIDDEN',
    );
    expect(classifyError({ httpStatus: 200, providerErrorCode: 'cannot_perform_operation' })).toBe(
      'PERMANENT_FORBIDDEN',
    );
  });

  it('maps Google insufficientPermissions to PERMANENT_FORBIDDEN (case-insensitive)', () => {
    expect(classifyError({ providerErrorCode: 'insufficientPermissions' })).toBe(
      'PERMANENT_FORBIDDEN',
    );
  });

  it('falls through to PERMANENT_OTHER for an empty input', () => {
    expect(classifyError({})).toBe('PERMANENT_OTHER');
  });

  it('maps other 4xx to PERMANENT_OTHER', () => {
    expect(classifyError({ httpStatus: 400 })).toBe('PERMANENT_OTHER');
    expect(classifyError({ httpStatus: 422 })).toBe('PERMANENT_OTHER');
  });

  it('rate-limit precedence beats a forbidden provider code', () => {
    const result: ErrorClass = classifyError({
      httpStatus: 429,
      providerErrorCode: 'cannot_perform_operation',
    });
    expect(result).toBe('TRANSIENT_RATE_LIMIT');
  });
});

// Per-provider classification for the three new IdPs. The classifier is
// signal-driven (status/headers/body/code), not provider-keyed, so the
// `provider` hint is passed for documentation; behavior is asserted.
describe.each([
  { provider: 'ENTRA' as const },
  { provider: 'OKTA' as const },
  { provider: 'GITHUB' as const },
])('classifyError per-provider HTTP-status mapping ($provider)', ({ provider }) => {
  it('401 → PERMANENT_AUTH_EXPIRED', () => {
    expect(classifyError({ provider, httpStatus: 401 })).toBe('PERMANENT_AUTH_EXPIRED');
  });

  it('403 (plain forbidden) → PERMANENT_FORBIDDEN', () => {
    expect(classifyError({ provider, httpStatus: 403 })).toBe('PERMANENT_FORBIDDEN');
  });

  it('404 → PERMANENT_NOT_FOUND', () => {
    expect(classifyError({ provider, httpStatus: 404 })).toBe('PERMANENT_NOT_FOUND');
  });

  it('429 → TRANSIENT_RATE_LIMIT', () => {
    expect(classifyError({ provider, httpStatus: 429 })).toBe('TRANSIENT_RATE_LIMIT');
  });

  it('default 4xx (400 / 422) → PERMANENT_OTHER', () => {
    expect(classifyError({ provider, httpStatus: 400 })).toBe('PERMANENT_OTHER');
    expect(classifyError({ provider, httpStatus: 422 })).toBe('PERMANENT_OTHER');
  });

  it('network / timeout cause → TRANSIENT_NETWORK', () => {
    const timeout = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
    expect(classifyError({ provider, cause: timeout })).toBe('TRANSIENT_NETWORK');
  });
});

describe('classifyError provider-specific cases', () => {
  it('Entra 403 Authorization_RequestDenied → PERMANENT_FORBIDDEN (no retry)', () => {
    expect(
      classifyError({
        provider: 'ENTRA',
        httpStatus: 403,
        providerErrorCode: 'Authorization_RequestDenied',
      }),
    ).toBe('PERMANENT_FORBIDDEN');
  });

  it('GitHub 403 with x-ratelimit-remaining:0 → TRANSIENT_RATE_LIMIT (not forbidden)', () => {
    expect(
      classifyError({
        provider: 'GITHUB',
        httpStatus: 403,
        responseHeaders: { 'x-ratelimit-remaining': '0' },
      }),
    ).toBe('TRANSIENT_RATE_LIMIT');
  });

  it('GitHub 403 with retry-after header → TRANSIENT_RATE_LIMIT', () => {
    expect(
      classifyError({
        provider: 'GITHUB',
        httpStatus: 403,
        responseHeaders: { 'retry-after': '60' },
      }),
    ).toBe('TRANSIENT_RATE_LIMIT');
  });

  it('GitHub 403 with "secondary rate limit" body → TRANSIENT_RATE_LIMIT', () => {
    expect(
      classifyError({
        provider: 'GITHUB',
        httpStatus: 403,
        responseBody: 'You have exceeded a secondary rate limit',
      }),
    ).toBe('TRANSIENT_RATE_LIMIT');
  });

  it('GitHub 403 require_two_factor_authentication → PERMANENT_FORBIDDEN', () => {
    expect(
      classifyError({
        provider: 'GITHUB',
        httpStatus: 403,
        providerErrorCode: 'require_two_factor_authentication',
      }),
    ).toBe('PERMANENT_FORBIDDEN');
  });

  it('GitHub plain 403 (no rate-limit signal) stays PERMANENT_FORBIDDEN', () => {
    expect(classifyError({ provider: 'GITHUB', httpStatus: 403 })).toBe('PERMANENT_FORBIDDEN');
  });
});
