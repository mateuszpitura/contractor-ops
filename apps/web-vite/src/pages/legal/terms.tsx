import {
  SOFTWARE_NOT_LEGAL_ADVICE_DE,
  SOFTWARE_NOT_LEGAL_ADVICE_EN,
} from '@contractor-ops/validators';
import { useTranslation } from 'react-i18next';

import { LegalDocumentCallout } from '../../components/legal/legal-document-callout.js';
import { LegalDocumentLayout } from '../../components/legal/legal-document-layout.js';
import { H1, H2, P } from '../../components/legal/privacy-prose.js';
import { useTranslations } from '../../i18n/useTranslations.js';

const SECTIONS = [
  'acceptance',
  'serviceDescription',
  'accounts',
  'dataProcessing',
  'acceptableUse',
  'intellectualProperty',
  'liability',
  'termination',
  'governingLaw',
] as const;

export default function LegalTermsPage() {
  const { i18n } = useTranslation();
  const t = useTranslations('Legal.terms');
  const softwareNotLegalAdvice =
    i18n.language === 'de' ? SOFTWARE_NOT_LEGAL_ADVICE_DE : SOFTWARE_NOT_LEGAL_ADVICE_EN;

  return (
    <LegalDocumentLayout current="terms">
      <H1>{t('title')}</H1>
      <P className="text-muted-foreground">{t('lastUpdated')}</P>

      {SECTIONS.map(section => (
        <section key={section}>
          <H2 id={section}>{t(`sections.${section}.heading`)}</H2>
          <P>{t(`sections.${section}.body`)}</P>
        </section>
      ))}

      <section>
        {/* biome-ignore lint/correctness/useUniqueElementIds: stable anchor for TOC + deep links */}
        <H2 id="software-not-legal-advice">{t('sections.softwareNotLegalAdvice.heading')}</H2>
        <P className="text-muted-foreground">{t('sections.softwareNotLegalAdvice.subheading')}</P>
        <LegalDocumentCallout>{softwareNotLegalAdvice}</LegalDocumentCallout>
      </section>

      <section>
        {/* biome-ignore lint/correctness/useUniqueElementIds: stable anchor for TOC + deep links */}
        <H2 id="contact">{t('sections.contact.heading')}</H2>
        <P>{t('sections.contact.body')}</P>
      </section>
    </LegalDocumentLayout>
  );
}
