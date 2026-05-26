import { useTranslations } from '../../i18n/useTranslations.js';

const SECTIONS = ['introduction', 'list', 'changes', 'objection', 'contact'] as const;

// Decision: static i18n — renders Legal.subProcessors heading + 5 body sections
// from the SECTIONS list. No hook layer beyond useTranslations.
export function LegalSubProcessorsContainer() {
  const t = useTranslations('Legal.subProcessors');

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
