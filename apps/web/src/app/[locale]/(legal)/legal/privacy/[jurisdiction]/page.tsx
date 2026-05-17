import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CmsLexicalRenderer } from '@/components/legal/cms-lexical-renderer';
import { PrivacyNoticeLayout } from '@/components/legal/privacy-notice-layout';
import { fetchLegalDocument } from '@/lib/legal/fetch-cms';
import { isPrivacyJurisdictionSlug } from '../_resolve';

export const metadata: Metadata = {
  title: 'Privacy Notice — Contractor Ops',
};

type Props = {
  params: Promise<{ locale: string; jurisdiction: string }>;
};

const JURISDICTION_LABEL: Record<'gb' | 'de' | 'eu', 'GB' | 'DE' | 'EU'> = {
  gb: 'GB',
  de: 'DE',
  eu: 'EU',
};

export default async function PrivacyJurisdictionPage({ params }: Props) {
  const { locale, jurisdiction } = await params;
  if (!isPrivacyJurisdictionSlug(jurisdiction)) {
    notFound();
  }

  const cmsDoc = await fetchLegalDocument({
    type: 'privacy',
    jurisdiction,
    locale,
  });

  return (
    <PrivacyNoticeLayout
      jurisdiction={JURISDICTION_LABEL[jurisdiction]}
      versionLabel={
        cmsDoc?.version && cmsDoc?.effectiveDate
          ? `Version ${cmsDoc.version} · Effective ${cmsDoc.effectiveDate}`
          : undefined
      }>
      {cmsDoc ? (
        <CmsLexicalRenderer data={cmsDoc.body} />
      ) : (
        <p>Privacy notice content is being migrated. Please check back shortly.</p>
      )}
    </PrivacyNoticeLayout>
  );
}
