// apps/web/src/app/[locale]/(dashboard)/settings/e-invoicing/log/page.tsx
//
// Settings → E-invoicing → Log page.
//
// Surfaces the org-wide e-invoice transmissions log via the
// `einvoice.listByOrg` tRPC procedure. Wired as a sibling to the main
// e-invoicing settings page so admins can audit validation / transmission
// status (Peppol, KSeF, ZATCA, etc.) without navigating per-invoice.

'use client';

import { AtelierPageHeader } from '@contractor-ops/ui';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@contractor-ops/ui/components/shadcn/breadcrumb';
import { useTranslations } from 'next-intl';
import { TransmissionsLogCard } from '@/components/settings/e-invoicing/transmissions-log-card';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EInvoicingTransmissionLogPage() {
  const t = useTranslations('EInvoice.TransmissionsLog');
  const tSettings = useTranslations('EInvoice.Settings');
  const tCommon = useTranslations('Settings');

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings">{tCommon('title')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/settings/e-invoicing">{tSettings('h1')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('breadcrumb')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <AtelierPageHeader title={t('h1')} description={t('subline')} />

      <TransmissionsLogCard />
    </div>
  );
}
