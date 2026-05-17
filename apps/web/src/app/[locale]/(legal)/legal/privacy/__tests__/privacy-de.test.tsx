// Covers FOUND-06 (DE privacy notice locked phrases + IDOR guard).

import { describe, expect, it, vi } from 'vitest';
import { render } from '@/test/test-utils';
import DePrivacyPage from '../(content)/de/page';

const EXPECTED_LOCKED_PHRASES = [
  'Verantwortlicher im Sinne der DSGVO',
  'Ihre Rechte als betroffene Person',
  'Datenschutzbeauftragter',
  'Beschwerderecht bei der Aufsichtsbehörde',
  'Umsatzsteuer-Identifikationsnummer (USt-IdNr)',
  'Steuernummer',
  'Handelsregisternummer',
  'Sozialversicherungsnummer',
  'Kleinunternehmer gemäß § 19 UStG',
] as const;

describe('DE privacy notice content (FOUND-06)', () => {
  it.each(EXPECTED_LOCKED_PHRASES)('renders verbatim locked phrase %s', phrase => {
    const { container } = render(<DePrivacyPage />);
    expect(container.textContent).toContain(phrase);
  });
});

describe('DE privacy routing redirect (FOUND-06)', () => {
  it('redirects /legal/privacy to /legal/privacy/de when org.countryCode=DE', async () => {
    // Plan 07 exports a resolver / server helper that maps countryCode -> redirect URL.
    const { resolvePrivacyRedirect } = (await import('../(content)/_resolve')) as {
      resolvePrivacyRedirect: (input: { countryCode: string }) => string;
    };
    expect(resolvePrivacyRedirect({ countryCode: 'DE' })).toBe('/legal/privacy/de');
  });
});

describe('DE privacy PDF IDOR guard (FOUND-06, V4 Access Control)', () => {
  it('rejects or coerces jurisdiction mismatch when session org is DE', async () => {
    // Plan 07 must enforce jurisdiction=session.org.countryCode server-side; client
    // input 'SA' must be rejected or coerced. Test calls the tRPC mutation handler
    // directly (Plan 07 exposes a pure function for this check).
    const { assertJurisdictionOrReject } = (await import(
      '@/server/api/routers/privacy-pdf.guard'
    )) as {
      assertJurisdictionOrReject: (input: {
        sessionOrgCountryCode: string;
        requestedJurisdiction: string;
      }) => void;
    };
    const enforce = vi.fn(assertJurisdictionOrReject);
    expect(() => enforce({ sessionOrgCountryCode: 'DE', requestedJurisdiction: 'SA' })).toThrow();
  });
});
