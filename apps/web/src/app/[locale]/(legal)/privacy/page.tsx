import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';

export const metadata: Metadata = {
  title: 'Privacy Policy — Contractor Ops',
};

export default function PrivacyPolicyPage() {
  const t = useTranslations('Legal.privacy');

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p className="text-muted-foreground">{t('lastUpdated')}</p>

      <h2>{t('sections.introduction.heading')}</h2>
      <p>{t('sections.introduction.body')}</p>

      <h2>{t('sections.dataCollected.heading')}</h2>
      <p>{t('sections.dataCollected.body')}</p>

      <h2>{t('sections.purpose.heading')}</h2>
      <p>{t('sections.purpose.body')}</p>

      <h2>{t('sections.legalBasis.heading')}</h2>
      <p>{t('sections.legalBasis.body')}</p>

      <h2>{t('sections.dataSharing.heading')}</h2>
      <p>{t('sections.dataSharing.body')}</p>

      <h2>{t('sections.retention.heading')}</h2>
      <p>{t('sections.retention.body')}</p>

      <h2>{t('sections.security.heading')}</h2>
      <p>{t('sections.security.body')}</p>

      <h2>{t('sections.rights.heading')}</h2>
      <p>{t('sections.rights.body')}</p>

      <h2>{t('sections.cookies.heading')}</h2>
      <p>{t('sections.cookies.body')}</p>

      <h2>{t('sections.contact.heading')}</h2>
      <p>{t('sections.contact.body')}</p>
    </article>
  );
}
