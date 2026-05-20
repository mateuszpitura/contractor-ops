import { AtelierPageHeader, SectionLabel } from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Inbox } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { IntakeList } from '@/components/invoices/intake/intake-list';
import { getServerFlag } from '@/lib/server-flag';

/**
 * Invoice imports list page — `/invoices/intake`.
 *
 * Gated behind the `einvoice.import-enabled` feature flag (Phase 62).
 * When the flag is off the route returns 404 — no rendered placeholder,
 * no hidden navigation, no footprint for users who cannot use the feature.
 */

interface IntakePageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function IntakeListPage({ searchParams }: IntakePageProps) {
  const flagOn = await getServerFlag('einvoice.import-enabled');
  if (!flagOn) {
    notFound();
  }

  const { status } = await searchParams;
  const t = await getTranslations('EInvoice.intake');

  return (
    <div className="space-y-8">
      <AtelierPageHeader title={t('pageTitle')} description={t('pageSubtitle')} />
      <SectionLabel icon={Inbox}>{t('pageTitle')}</SectionLabel>
      <Suspense
        fallback={
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <Skeleton key={`intake-route-skel-${i}`} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        }>
        <IntakeList initialStatus={status ?? null} />
      </Suspense>
    </div>
  );
}
