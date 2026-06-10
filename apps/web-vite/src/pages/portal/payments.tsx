/**
 * Portal payments — route shell with inlined page content.
 */

import {
  AtelierStatusPill,
  DataTable,
  PaymentsIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Suspense, useCallback, useMemo } from 'react';

import { usePortalPayments } from '../../components/portal/hooks/use-portal-payments.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { formatMoneyAmount } from '../../lib/money.js';

interface PortalPaymentRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  paidAt: Date | string | null;
}

function PortalPaymentsPageContent() {
  const t = useTranslations('Portal');
  const router = useRouter();
  const { payments, isLoading } = usePortalPayments();
  const { formatDate } = usePortalDateFormatter();

  const handleNavigate = useCallback((href: string) => router.push(href), [router]);

  const rows = (payments ?? []) as PortalPaymentRow[];

  const columns = useMemo<ColumnDef<PortalPaymentRow>[]>(
    () => [
      {
        id: 'invoiceNumber',
        header: () => t('payments.columns.invoiceNumber'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.invoiceNumber}</span>
        ),
      },
      {
        id: 'amount',
        header: () => t('payments.columns.amount'),
        cell: ({ row }) => (
          <span className="text-sm">
            {formatMoneyAmount(row.original.amountMinor, row.original.currency, 'en-US')}
          </span>
        ),
      },
      {
        id: 'paymentDate',
        header: () => t('payments.columns.paymentDate'),
        cell: ({ row }) => <span className="text-sm">{formatDate(row.original.paidAt)}</span>,
      },
      {
        id: 'status',
        header: () => t('payments.columns.status'),
        cell: () => <AtelierStatusPill variant="success">{t('payments.paid')}</AtelierStatusPill>,
      },
    ],
    [t, formatDate],
  );

  const handleRowClick = useCallback(
    (row: PortalPaymentRow) => handleNavigate(`/portal/invoices/${row.invoiceId}`),
    [handleNavigate],
  );

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('payments.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <SectionLabel variant="portal">{t('payments.title')}</SectionLabel>
      </AnimateIn>

      <AnimateIn delay={2}>
        <DataTable
          columns={columns}
          data={rows}
          totalRows={rows.length}
          clientPagination
          pageIndex={0}
          pageSize={rows.length || 1}
          onPageChange={() => undefined}
          onPageSizeChange={() => undefined}
          isLoading={isLoading}
          entityLabel={t('payments.title')}
          hideChrome
          hideFooter
          hideDensityToggle
          constrainHeight={false}
          skeletonRows={3}
          emptyIllustration={PaymentsIllustration}
          emptyTitle={t('payments.emptyTitle')}
          emptyDescription={t('payments.emptyBody')}
          noResultsTitle={t('payments.emptyTitle')}
          noResultsDescription={t('payments.emptyBody')}
          onRowClick={handleRowClick}
          getRowId={row => row.id}
        />
      </AnimateIn>
    </div>
  );
}

export default function PortalPaymentsPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalPaymentsPageContent />
    </Suspense>
  );
}
