// Decision: static i18n page composer — orchestrates page header + 9 body sections
// from the Legal.breachNotification namespace into the prose article layout. No
// hook layer (pure i18n); decision is the section list + heading-body composition.

import { useTranslations } from '../../i18n/useTranslations.js';

const SECTIONS = [
  'introduction',
  'definition',
  'detection',
  'assessment',
  'authorityNotification',
  'customerNotification',
  'timeline',
  'documentation',
  'contact',
] as const;

export function LegalBreachNotificationContainer() {
  const t = useTranslations('Legal.breachNotification');

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
