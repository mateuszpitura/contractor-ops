// Covers FOUND-05 (UK privacy notice routing + accessibility).
//
// The verbatim Article-13 heading assertions previously lived against the
// hand-authored TSX page. Now that the body content is sourced from the
// `legal-documents` CMS collection, content fidelity is asserted at the
// CMS-side seed catalog level (apps/cms/src/lib/legal-content.ts) — see
// the lexical builder unit tests there. The route-level smoke checks
// below keep the redirect resolver pinned.

import { describe, expect, it } from 'vitest';

describe('GB privacy jurisdiction routing (FOUND-05)', () => {
  it('routes GB country code to /legal/privacy/gb', async () => {
    const { resolvePrivacyRedirect } = (await import('../_resolve')) as {
      resolvePrivacyRedirect: (input: { countryCode: string }) => string;
    };
    expect(resolvePrivacyRedirect({ countryCode: 'GB' })).toBe('/legal/privacy/gb');
  });

  it('accepts gb as a valid jurisdiction slug', async () => {
    const { isPrivacyJurisdictionSlug } = (await import('../_resolve')) as {
      isPrivacyJurisdictionSlug: (input: string) => boolean;
    };
    expect(isPrivacyJurisdictionSlug('gb')).toBe(true);
  });
});
