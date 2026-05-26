// Decision: static i18n page composer with language variant pick — selects
// DE vs EN "software is not legal advice" disclaimer based on i18n.language,
// then composes page header + 9 body sections + disclaimer + contact section.
// No hook layer (pure i18n); decision is the locale-keyed disclaimer choice +
// section composition.

import {
  SOFTWARE_NOT_LEGAL_ADVICE_DE,
  SOFTWARE_NOT_LEGAL_ADVICE_EN,
} from '@contractor-ops/validators';
import { useTranslation } from 'react-i18next';

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

export function LegalTermsContainer() {
  const { i18n } = useTranslation();
  const t = useTranslations('Legal.terms');
  const softwareNotLegalAdvice =
    i18n.language === 'de' ? SOFTWARE_NOT_LEGAL_ADVICE_DE : SOFTWARE_NOT_LEGAL_ADVICE_EN;

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p className="text-muted-foreground">{t('lastUpdated')}</p>

      {SECTIONS.map(section => (
        <section key={section}>
          <h2>{t(`sections.${section}.heading`)}</h2>
          <p>{t(`sections.${section}.body`)}</p>
        </section>
      ))}

      <section>
        <h2>{t('sections.softwareNotLegalAdvice.heading')}</h2>
        <p className="text-muted-foreground">{t('sections.softwareNotLegalAdvice.subheading')}</p>
        <blockquote className="not-italic border-l-4 border-amber-400 bg-amber-50 py-3 pl-4 text-sm text-amber-900">
          {softwareNotLegalAdvice}
        </blockquote>
      </section>

      <section>
        <h2>{t('sections.contact.heading')}</h2>
        <p>{t('sections.contact.body')}</p>
      </section>
    </article>
  );
}
