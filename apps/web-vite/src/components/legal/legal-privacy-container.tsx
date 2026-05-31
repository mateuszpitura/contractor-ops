import { useTranslations } from '../../i18n/useTranslations.js';
import { LegalDocumentLayout } from './legal-document-layout.js';
import { H1, H2, P } from './privacy-prose.js';

const SECTIONS = [
  'introduction',
  'dataCollected',
  'purpose',
  'legalBasis',
  'dataSharing',
  'retention',
  'rights',
  'security',
  'cookies',
  'contact',
] as const;

// Decision: static i18n — renders Legal.privacy heading + 12 body sections
// from the SECTIONS list. No hook layer beyond useTranslations.
export function LegalPrivacyContainer() {
  const t = useTranslations('Legal.privacy');

  return (
    <LegalDocumentLayout current="privacy">
      <H1>{t('title')}</H1>
      <P className="text-muted-foreground">{t('lastUpdated')}</P>

      {SECTIONS.map(section => (
        <section key={section}>
          <H2 id={section}>{t(`sections.${section}.heading`)}</H2>
          <P>{t(`sections.${section}.body`)}</P>
        </section>
      ))}
    </LegalDocumentLayout>
  );
}
