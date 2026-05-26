// Decision: route-param-driven variant pick — resolves `jurisdiction` from the
// route and either renders the 404 fallback or the jurisdiction-scoped privacy
// notice layout. No hook layer (pure i18n + route param).

import { useParams } from 'react-router-dom';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { isPrivacyJurisdictionSlug, JURISDICTION_LABEL } from './privacy-jurisdiction-resolve.js';
import { PrivacyNoticeLayout } from './privacy-notice-layout.js';
import { PrivacyNoticeStructuredContent } from './privacy-notice-structured-content.js';

export function LegalPrivacyJurisdictionContainer() {
  const tLegal = useTranslations('Legal');
  const params = useParams<{ jurisdiction: string }>();
  const jurisdiction = params.jurisdiction ?? '';

  if (!isPrivacyJurisdictionSlug(jurisdiction)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="mt-2 text-muted-foreground">Privacy notice not found.</p>
        <p className="mt-4">
          <Link href="/legal/privacy" className="text-primary hover:underline">
            ← {tLegal('privacyIndex.heading')}
          </Link>
        </p>
      </main>
    );
  }

  return (
    <PrivacyNoticeLayout jurisdiction={JURISDICTION_LABEL[jurisdiction]}>
      <PrivacyNoticeStructuredContent jurisdiction={jurisdiction} />
    </PrivacyNoticeLayout>
  );
}
