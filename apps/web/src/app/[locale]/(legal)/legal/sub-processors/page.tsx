import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getLocale } from 'next-intl/server';

import { CmsLexicalRenderer } from '@/components/legal/cms-lexical-renderer';
import { fetchLegalDocument } from '@/lib/legal/fetch-cms';

export const metadata: Metadata = {
  title: 'Sub-processors — Contractor Ops',
};

export default async function SubProcessorsPage() {
  const locale = await getLocale();
  const cmsDoc = await fetchLegalDocument({
    type: 'sub-processors',
    jurisdiction: 'eu',
    locale,
  });

  if (cmsDoc) {
    return (
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <CmsLexicalRenderer data={cmsDoc.body} />
      </article>
    );
  }

  return <SubProcessorsLegacy />;
}

function SubProcessorsLegacy() {
  const t = useTranslations('Legal.subProcessors');

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>{t('title')}</h1>
      <p className="text-muted-foreground">{t('lastUpdated')}</p>

      <h2>{t('sections.introduction.heading')}</h2>
      <p>{t('sections.introduction.body')}</p>

      <h2>{t('sections.processors.heading')}</h2>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2 pe-4 text-start font-semibold">{t('table.processor')}</th>
              <th className="py-2 pe-4 text-start font-semibold">{t('table.purpose')}</th>
              <th className="py-2 pe-4 text-start font-semibold">{t('table.dataProcessed')}</th>
              <th className="py-2 text-start font-semibold">{t('table.location')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(
              [
                'vercel',
                'neon',
                'cloudflare',
                'stripe',
                'resend',
                'sentry',
                'axiom',
                'upstash',
                'cronitor',
                'uptimerobot',
                'qstash',
              ] as const
            ).map(key => (
              <tr key={key}>
                <td className="py-2 pe-4 font-medium">{t(`processors.${key}.name`)}</td>
                <td className="py-2 pe-4">{t(`processors.${key}.purpose`)}</td>
                <td className="py-2 pe-4">{t(`processors.${key}.data`)}</td>
                <td className="py-2">{t(`processors.${key}.location`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t('sections.changes.heading')}</h2>
      <p>{t('sections.changes.body')}</p>

      <h2>{t('sections.contact.heading')}</h2>
      <p>{t('sections.contact.body')}</p>
    </article>
  );
}
