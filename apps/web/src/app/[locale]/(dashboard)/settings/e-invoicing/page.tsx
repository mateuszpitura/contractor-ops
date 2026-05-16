// apps/web/src/app/[locale]/(dashboard)/settings/e-invoicing/page.tsx
//
// Phase 61 · Plan 61-07 — Settings → E-invoicing page.
//
// Stacks the PeppolParticipantCard + LeitwegIdListCard under the page header.
// Each card is a client component that fetches its own data via tRPC React
// Query hooks; the page itself is a thin shell resolving i18n strings.

'use client';

import { AtelierPageHeader } from '@contractor-ops/ui';
import { ScrollText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LeitwegIdListCard } from '@/components/settings/e-invoicing/leitweg-id-list-card';
import { PeppolParticipantCard } from '@/components/settings/e-invoicing/peppol-participant-card';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EInvoicingSettingsPage() {
  const t = useTranslations('EInvoice.Settings');
  const tSettings = useTranslations('Settings');
  const tLog = useTranslations('EInvoice.TransmissionsLog');

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">{tSettings('title')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('h1')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <AtelierPageHeader title={t('h1')} description={t('subline')} />
        <Button variant="outline" size="sm" render={<Link href="/settings/e-invoicing/log" />}>
          <ScrollText className="me-1.5 h-4 w-4" />
          {tLog('viewLog')}
        </Button>
      </div>

      <div className="space-y-6">
        <PeppolParticipantCard />
        <LeitwegIdListCard />
      </div>
    </div>
  );
}
