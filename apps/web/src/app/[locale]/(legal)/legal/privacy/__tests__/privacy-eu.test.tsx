// Covers FOUND-05/06 fallback path.

import { describe, expect, it } from 'vitest';

describe('EU privacy jurisdiction fallback (FOUND-05/06)', () => {
  it.each([
    'PL',
    'FR',
    'ES',
    'IT',
    'NL',
  ])('falls back to /legal/privacy/eu for countryCode=%s', async countryCode => {
    const { resolvePrivacyRedirect } = (await import('../_resolve')) as {
      resolvePrivacyRedirect: (input: { countryCode: string }) => string;
    };
    expect(resolvePrivacyRedirect({ countryCode })).toBe('/legal/privacy/eu');
  });

  it.each([
    'GB',
    'DE',
    'AE',
    'SA',
  ])('does NOT fall back to EU for jurisdiction-specific code %s', async countryCode => {
    const { resolvePrivacyRedirect } = (await import('../_resolve')) as {
      resolvePrivacyRedirect: (input: { countryCode: string }) => string;
    };
    expect(resolvePrivacyRedirect({ countryCode })).not.toBe('/legal/privacy/eu');
  });
});
