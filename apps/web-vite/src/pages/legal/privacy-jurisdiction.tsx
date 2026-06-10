import { useParams } from 'react-router-dom';

import { Link } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { isPrivacyJurisdictionSlug, JURISDICTION_LABEL } from '../../components/legal/privacy-jurisdiction-resolve.js';
import { PrivacyNoticeLayout } from '../../components/legal/privacy-notice-layout.js';
import { PrivacyNoticeStructuredContent } from '../../components/legal/privacy-notice-structured-content.js';

export default function LegalPrivacyJurisdictionPage() {
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
