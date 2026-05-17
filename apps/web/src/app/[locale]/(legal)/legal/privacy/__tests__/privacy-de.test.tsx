// Covers FOUND-06 (DE privacy notice routing + IDOR guard).
//
// The verbatim DE locked-phrase assertions previously lived against the
// hand-authored TSX page. With body content now sourced from the
// `legal-documents` CMS collection, content-fidelity coverage moves to
// the CMS seed catalog (apps/cms/src/lib/legal-content.ts) and the
// Lexical builder unit tests. The route-level checks below stay pinned.

import { describe, expect, it, vi } from 'vitest';

describe('DE privacy jurisdiction routing (FOUND-06)', () => {
  it('redirects /legal/privacy to /legal/privacy/de when org.countryCode=DE', async () => {
    const { resolvePrivacyRedirect } = (await import('../_resolve')) as {
      resolvePrivacyRedirect: (input: { countryCode: string }) => string;
    };
    expect(resolvePrivacyRedirect({ countryCode: 'DE' })).toBe('/legal/privacy/de');
  });
});

describe('DE privacy PDF IDOR guard (FOUND-06, V4 Access Control)', () => {
  it('rejects or coerces jurisdiction mismatch when session org is DE', async () => {
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
