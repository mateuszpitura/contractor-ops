// Decision: static i18n page composer — orchestrates page header + 12 body sections
// from the Legal.privacy namespace into the prose article layout. No hook layer
// (pure i18n); decision is the section list + heading-body composition.

import { useTranslations } from '../../i18n/useTranslations.js';

const SECTIONS = [
  'introduction',
  'controllerContact',
  'dataCollected',
  'legalBasis',
  'purposes',
  'sharing',
  'transfers',
  'retention',
  'rights',
  'security',
  'cookies',
  'contact',
] as const;

export function LegalPrivacyContainer() {
  const t = useTranslations('Legal.privacy');

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
    </article>
  );
}
