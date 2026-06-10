import { useTranslations } from '../../i18n/useTranslations.js';
import { LegalDocumentLayout } from '../../components/legal/legal-document-layout.js';
import { H1, H2, P } from '../../components/legal/privacy-prose.js';
import { SubProcessorsTable } from '../../components/legal/sub-processors/data-table.js';

const SECTIONS = ['introduction', 'processors', 'changes', 'objection', 'contact'] as const;

export default function LegalSubProcessorsPage() {
  const t = useTranslations('Legal.subProcessors');

  return (
    <LegalDocumentLayout current="sub-processors">
      <H1>{t('title')}</H1>
      <P className="text-muted-foreground">{t('lastUpdated')}</P>

      {SECTIONS.map(section => (
        <section key={section}>
          <H2 id={section}>{t(`sections.${section}.heading`)}</H2>
          {section === 'processors' ? (
            <>
              <P>{t('sections.processors.body')}</P>
              <SubProcessorsTable t={t} />
            </>
          ) : (
            <P>{t(`sections.${section}.body`)}</P>
          )}
        </section>
      ))}
    </LegalDocumentLayout>
  );
}
