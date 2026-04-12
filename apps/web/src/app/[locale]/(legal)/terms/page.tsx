import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';

export const metadata: Metadata = {
  title: 'Terms of Service — Contractor Ops',
};

export default function TermsOfServicePage() {
  const t = useTranslations('Legal.terms');

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p className="text-muted-foreground">{t('lastUpdated')}</p>

      <h2>{t('sections.acceptance.heading')}</h2>
      <p>{t('sections.acceptance.body')}</p>

      <h2>{t('sections.serviceDescription.heading')}</h2>
      <p>{t('sections.serviceDescription.body')}</p>

      <h2>{t('sections.accounts.heading')}</h2>
      <p>{t('sections.accounts.body')}</p>

      <h2>{t('sections.dataProcessing.heading')}</h2>
      <p>{t('sections.dataProcessing.body')}</p>

      <h2>{t('sections.acceptableUse.heading')}</h2>
      <p>{t('sections.acceptableUse.body')}</p>

      <h2>{t('sections.intellectualProperty.heading')}</h2>
      <p>{t('sections.intellectualProperty.body')}</p>

      <h2>{t('sections.liability.heading')}</h2>
      <p>{t('sections.liability.body')}</p>

      <h2>{t('sections.termination.heading')}</h2>
      <p>{t('sections.termination.body')}</p>

      <h2>{t('sections.governingLaw.heading')}</h2>
      <p>{t('sections.governingLaw.body')}</p>

      <h2>{t('sections.contact.heading')}</h2>
      <p>{t('sections.contact.body')}</p>
    </article>
  );
}
