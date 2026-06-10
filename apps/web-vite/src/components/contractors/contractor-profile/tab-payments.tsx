import {
  AtelierEmptyState,
  DataTable,
  PaymentsIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import { CreditCard } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';

import { DefaultSkontoSection } from '../billing-profile/default-skonto-section.js';
import { useContractorBillingSkontoSection } from '../hooks/use-contractor-billing-skonto-section.js';
import type { ContractorTabPaymentRow } from '../hooks/use-contractor-tab-payments.js';
import { useContractorTabPayments } from '../hooks/use-contractor-tab-payments.js';

const itemStatusBadgeColors: Record<string, string> = {
  PENDING: 'bg-muted text-muted-foreground border border-border',
  PAID: 'bg-green-500/10 text-green-800 dark:text-green-400',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  EXPORTED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};

const PAGE_SIZE = 10;

export type TabPaymentsViewProps = {
  contractorId: string;
} & ReturnType<typeof useContractorTabPayments>;

export function TabPaymentsView({
  contractorId: _contractorId,
  page,
  setPage,
  allItems,
  totalPages,
  totalPaidMinor,
  totalPaidCurrency,
  formatAmount,
  isLoading,
}: TabPaymentsViewProps) {
  const t = useTranslations('Payments');
  const tInvoices = useTranslations('Invoices');
  const { formatDate } = useDateFormatter();

  const columns: ColumnDef<ContractorTabPaymentRow>[] = useMemo(
    () => [
      {
        accessorKey: 'runNumber',
        header: t('columnRunNumber'),
        cell: ({ row }) => (
          <Link href="/payments" className="font-medium text-primary hover:underline">
            {row.original.runNumber}
          </Link>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('columnDate'),
        cell: ({ row }) => {
          if (!row.original.createdAt)
            return <span className="text-muted-foreground">&mdash;</span>;
          try {
            return <span className="text-sm">{formatDate(row.original.createdAt)}</span>;
          } catch {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
        },
      },
      {
        accessorKey: 'invoiceNumber',
        header: t('columnInvoiceNumber'),
        cell: ({ row }) => (
          <Link
            href={`/invoices/${row.original.invoiceId}`}
            className="font-medium text-primary hover:underline">
            {row.original.invoiceNumber}
          </Link>
        ),
      },
      {
        accessorKey: 'amountMinor',
        header: t('columnAmount'),
        cell: ({ row }) => (
          <span className="font-mono text-sm tabular-nums">
            {formatAmount(row.original.amountMinor, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('columnStatus'),
        cell: ({ row }) => (
          <Badge variant="secondary" className={itemStatusBadgeColors[row.original.status] ?? ''}>
            {t(
              `itemStatus${row.original.status.charAt(0) + row.original.status.slice(1).toLowerCase()}` as Parameters<
                typeof t
              >[0],
            )}
          </Badge>
        ),
      },
      {
        accessorKey: 'paymentReference',
        header: t('columnReference'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.paymentReference ?? '—'}
          </span>
        ),
      },
    ],
    [t, formatAmount, formatDate],
  );

  const handlePageChange = useCallback(
    (nextIndex: number) => setPage(Math.max(1, Math.min(totalPages, nextIndex + 1))),
    [setPage, totalPages],
  );

  if (!isLoading && allItems.length === 0) {
    return (
      <AtelierEmptyState
        variant="subview"
        illustration={PaymentsIllustration}
        heading={t('contractorEmptyHeading')}
        body={t('contractorEmptyBody')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={CreditCard}>{t('tabPayments')}</SectionLabel>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('totalPaid')}:</span>
          {isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatAmount(totalPaidMinor, totalPaidCurrency)}
            </span>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={allItems}
        totalRows={allItems.length}
        clientPagination
        pageIndex={Math.max(0, page - 1)}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        onPageSizeChange={() => undefined}
        isLoading={isLoading}
        constrainHeight={false}
        hideDensityToggle
        entityLabel={tInvoices('entityLabel', { count: allItems.length })}
        emptyTitle={t('contractorEmptyHeading')}
        emptyDescription={t('contractorEmptyBody')}
        noResultsTitle={t('contractorEmptyHeading')}
        skeletonRows={5}
      />
    </div>
  );
}

type TabPaymentsContainerProps = {
  contractorId: string;
};

export function TabPaymentsContainer({ contractorId }: TabPaymentsContainerProps) {
  const payments = useContractorTabPayments(contractorId);
  const billingSkonto = useContractorBillingSkontoSection(contractorId);

  const { billingProfileId } = billingSkonto;
  if (!billingProfileId) {
    return (
      <div className="space-y-4">
        <TabPaymentsView {...payments} contractorId={contractorId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <DefaultSkontoSection
            billingProfileId={billingProfileId}
            featureEnabled={billingSkonto.featureEnabled}
            existingDefault={billingSkonto.existingDefault}
          />
        </CardContent>
      </Card>
      <TabPaymentsView {...payments} contractorId={contractorId} />
    </div>
  );
}

/** @deprecated Use TabPayments */
export { TabPaymentsContainer as TabPayments };
