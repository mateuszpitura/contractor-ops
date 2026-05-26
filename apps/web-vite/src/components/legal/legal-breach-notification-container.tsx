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

// Decision: static i18n — renders Legal.breachNotification heading + 9 body
// sections from the SECTIONS list. No hook layer beyond useTranslations.
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
