// Wave 0 scaffold — implemented in Plan 07 (EU privacy notice fallback)
// Tests fail by design until Plan 07 creates the EU MDX page and adds the
// fallback routing rule (countryCode not in {GB, DE, AE, SA} -> /legal/privacy/eu).
// Covers FOUND-05/06 fallback path.

import { describe, expect, it } from 'vitest';
import { render } from '@/test/test-utils';
// @ts-expect-error Plan 07 creates this module
import EuPrivacyPage from '../(content)/eu/page.mdx';

describe('EU privacy notice fallback (FOUND-05/06)', () => {
  it('renders without throwing (fallback MDX page exists)', () => {
    const { container } = render(<EuPrivacyPage />);
    expect(container.textContent).toBeTruthy();
  });

  it.each([
    'PL',
    'FR',
    'ES',
    'IT',
    'NL',
  ])('falls back to /legal/privacy/eu for countryCode=%s', async countryCode => {
    const { resolvePrivacyRedirect } = (await import('../(content)/_resolve')) as {
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
    const { resolvePrivacyRedirect } = (await import('../(content)/_resolve')) as {
      resolvePrivacyRedirect: (input: { countryCode: string }) => string;
    };
    expect(resolvePrivacyRedirect({ countryCode })).not.toBe('/legal/privacy/eu');
  });
});
