// apps/web/src/app/[locale]/(dashboard)/settings/e-invoicing/page.tsx
//
// Phase 61 · Plan 61-07 — Settings → E-invoicing page.
//
// Stacks the PeppolParticipantCard + LeitwegIdListCard under the page header.
// Each card is a client component that fetches its own data via tRPC React
// Query hooks; the page itself is a thin shell resolving i18n strings.

'use client';

import { useTranslations } from 'next-intl';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { LeitwegIdListCard } from '@/components/settings/e-invoicing/leitweg-id-list-card';
import { PeppolParticipantCard } from '@/components/settings/e-invoicing/peppol-participant-card';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EInvoicingSettingsPage() {
  const t = useTranslations('EInvoice.Settings');
  const tSettings = useTranslations('Settings');

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

      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t('h1')}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">{t('subline')}</p>
      </div>

      <div className="space-y-6">
        <PeppolParticipantCard />
        <LeitwegIdListCard />
      </div>
    </div>
  );
}
