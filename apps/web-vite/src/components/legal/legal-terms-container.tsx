import {
  SOFTWARE_NOT_LEGAL_ADVICE_DE,
  SOFTWARE_NOT_LEGAL_ADVICE_EN,
} from '@contractor-ops/validators';
import { useTranslation } from 'react-i18next';

import { useTranslations } from '../../i18n/useTranslations.js';
import { LegalDocumentCallout } from './legal-document-callout.js';
import { LegalDocumentLayout } from './legal-document-layout.js';
import { H1, H2, P } from './privacy-prose.js';

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

// Decision: static i18n — renders Legal.terms heading + 9 body sections plus
// a locale-keyed (DE/EN) disclaimer and contact section.
export function LegalTermsContainer() {
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
