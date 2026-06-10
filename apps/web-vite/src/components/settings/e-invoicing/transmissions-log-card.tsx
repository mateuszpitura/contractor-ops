// Renders the org-wide e-invoice transmissions log card (Settings →
// E-invoicing → Log). Consumes `einvoice.listByOrg` for filtered server-
// side pagination via cursor + status enum.

import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@contractor-ops/ui/components/shadcn/tabs';
import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo } from 'react';
import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTransmissionsLogCard } from './hooks/use-transmissions-log-card.js';
import type {
  LifecycleRow,
  StatusFilter,
  useTransmissionsLogCard as UseTransmissionsLogCard,
} from './hooks/use-transmissions-log-card.js';
import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';

// ---------------------------------------------------------------------------
// Pills
// ---------------------------------------------------------------------------

const validationPillClass: Record<string, string> = {
  VALID: 'bg-green-500/10 text-green-800 dark:text-green-400',
  WARNINGS: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  INVALID: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const transmissionPillClass: Record<string, string> = {
  SENT: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  DELIVERED: 'bg-green-500/10 text-green-800 dark:text-green-400',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  PENDING: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export type TransmissionsLogCardProps = ReturnType<typeof UseTransmissionsLogCard> & {
  formatDate: (value: Date | string | null | undefined) => string;
};

export function TransmissionsLogCardView({
  formatDate,
  t,
  status,
  setStatus,
  listQuery,
  rows,
  isLoading,
}: TransmissionsLogCardProps) {
  const handleStatusChange = useCallback((v: string) => setStatus(v as StatusFilter), [setStatus]);
  const handleLoadMore = useCallback(() => {
    listQuery.fetchNextPage();
  }, [listQuery]);

  const columns = useMemo<ColumnDef<LifecycleRow, unknown>[]>(
    () => [
      {
        id: 'invoice',
        header: () => t('col.invoice'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.invoiceNumber ?? t('unknownInvoice')}
          </span>
        ),
      },
      {
        id: 'validation',
        header: () => t('col.validation'),
        enableSorting: false,
        cell: ({ row }) => {
          const validation = row.original.eInvoiceLifecycle?.validationStatus ?? null;
          return validation ? (
            <Badge variant="secondary" className={validationPillClass[validation] ?? ''}>
              {tDynLoose(t as LooseTranslator, 'validation', validation)}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">{t('validation.notGenerated')}</span>
          );
        },
      },
      {
        id: 'transmission',
        header: () => t('col.transmission'),
        enableSorting: false,
        cell: ({ row }) => {
          const transmission = row.original.eInvoiceLifecycle?.transmissionStatus ?? null;
          return transmission ? (
            <Badge variant="secondary" className={transmissionPillClass[transmission] ?? ''}>
              {tDynLoose(t as LooseTranslator, 'transmission', transmission)}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">&mdash;</span>
          );
        },
      },
      {
        id: 'updated',
        header: () => t('col.updated'),
        enableSorting: false,
        cell: ({ row }) => {
          const updatedAt =
            row.original.eInvoiceLifecycle?.updatedAt ?? row.original.createdAt ?? null;
          return (
            <span className="text-sm text-muted-foreground tabular-nums">
              {updatedAt ? formatDate(updatedAt) : '—'}
            </span>
          );
        },
      },
    ],
    [t, formatDate],
  );

  const getRowId = useCallback((row: LifecycleRow) => row.id, []);
  const noop = useCallback(() => undefined, []);

  return (
    <Card data-testid="einvoice-transmissions-log">
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle className="text-xl">{t('cardTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground max-w-prose">{t('cardDescription')}</p>
        </div>
        <Tabs value={status} onValueChange={handleStatusChange}>
          <TabsList>
            <TabsTrigger value="all">{t('filter.all')}</TabsTrigger>
            <TabsTrigger value="notGenerated">{t('filter.notGenerated')}</TabsTrigger>
            <TabsTrigger value="valid">{t('filter.valid')}</TabsTrigger>
            <TabsTrigger value="warnings">{t('filter.warnings')}</TabsTrigger>
            <TabsTrigger value="invalid">{t('filter.invalid')}</TabsTrigger>
            <TabsTrigger value="transmitted">{t('filter.transmitted')}</TabsTrigger>
            <TabsTrigger value="failed">{t('filter.failed')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <h3 className="text-base font-semibold">{t('emptyHeading')}</h3>
            <p className="text-sm text-muted-foreground max-w-prose">{t('emptyBody')}</p>
          </div>
        ) : (
          <>
            <WorkbenchDataTable
              sectionClassName=""
              columns={columns}
              data={rows}
              totalRows={rows.length}
              clientPagination
              pageIndex={0}
              pageSize={rows.length || 1}
              onPageChange={noop}
              onPageSizeChange={noop}
              getRowId={getRowId}
              hideChrome
              hideFooter
              hideDensityToggle
              constrainHeight={false}
              entityLabel="transmissions"
              emptyTitle=""
              noResultsTitle=""
            />

            {listQuery.hasNextPage ? (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={listQuery.isFetchingNextPage}>
                  {listQuery.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function TransmissionsLogCard() {
  const { formatDate } = useDateFormatter();
  const card = useTransmissionsLogCard();
  return <TransmissionsLogCardView formatDate={formatDate} {...card} />;
}
