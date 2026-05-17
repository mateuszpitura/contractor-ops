// Covers FOUND-05/06 fallback path.

import { describe, expect, it } from 'vitest';
import { render } from '@/test/test-utils';
import EuPrivacyPage from '../(content)/eu/page';

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
