import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';
import {
  AtelierStatusPill,
  DataTable,
  PaymentsIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { AnimateIn } from '../shared/animate-in.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { usePortalPayments } from './hooks/use-portal-payments.js';

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: minorUnitDigits(currency),
  }).format(minorToMajor(minor, currency));
}

interface PortalPaymentRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  paidAt: Date | string | null;
}

export function PortalPaymentsContainer() {
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
            {formatAmount(row.original.amountMinor, row.original.currency)}
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
