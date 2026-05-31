import { DataTable } from '@contractor-ops/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import type { useZatcaInvoiceChainTable } from '../hooks/use-zatca-invoice-chain-table.js';
import type { ZatcaBadgeStatus } from '../zatca-status-badge.js';
import { ZatcaStatusBadge } from '../zatca-status-badge.js';

const RESUBMITTABLE_STATUSES = new Set(['REJECTED', 'PENDING']);

interface ResubmitRowButtonProps {
  invoiceId: string;
  icv: number;
  onOpenResubmit: (invoiceId: string, icv: number) => void;
  label: string;
}

function ResubmitRowButton({ invoiceId, icv, onOpenResubmit, label }: ResubmitRowButtonProps) {
  const handleClick = useCallback(
    () => onOpenResubmit(invoiceId, icv),
    [onOpenResubmit, invoiceId, icv],
  );
  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <RefreshCw className="me-1.5 size-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
}

function formatDate(value: string | Date | null | undefined, locale?: string): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString();
  }
}

function truncate(value: string | undefined, max = 12): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export type ZatcaInvoiceChainTableViewProps = {
  pageSize?: number;
};

type HookResult = ReturnType<typeof useZatcaInvoiceChainTable>;
type ChainEntry = HookResult['entries'][number];

export function ZatcaInvoiceChainTableSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-24" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 rounded-lg border p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`zatca-chain-skel-${i}`} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ZatcaInvoiceChainTableEmpty({
  isFetching,
  refetchChain,
  t,
}: Pick<HookResult, 'isFetching' | 'refetchChain' | 't'>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
        <Button variant="ghost" size="sm" onClick={refetchChain} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="me-1.5 size-3.5" aria-hidden="true" />
          )}
          {t('refresh')}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ZatcaInvoiceChainTableView({
  isFetching,
  entries,
  pendingResubmit,
  openResubmitDialog,
  closeResubmitDialog,
  confirmResubmit,
  isResubmitPending,
  refetchChain,
  t,
}: Omit<HookResult, 'isLoading'>) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<ChainEntry, unknown>[]>(
    () => [
      {
        id: 'icv',
        accessorKey: 'icv',
        header: t('table.icv'),
        size: 64,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.icv}</span>,
      },
      {
        id: 'invoice',
        accessorFn: row => row.zatcaUuid || row.invoiceId,
        header: t('table.invoice'),
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className="font-mono text-xs"
            title={row.original.zatcaUuid || row.original.invoiceId}>
            {truncate(row.original.zatcaUuid || row.original.invoiceId)}
          </span>
        ),
      },
      {
        id: 'submitted',
        accessorFn: row =>
          row.submittedAt ? new Date(row.submittedAt).getTime() : new Date(row.createdAt).getTime(),
        header: t('table.submitted'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.submittedAt ?? row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'zatcaStatus',
        header: t('table.status'),
        cell: ({ row }) => (
          <ZatcaStatusBadge status={row.original.zatcaStatus as ZatcaBadgeStatus} />
        ),
      },
      {
        id: 'actions',
        header: () => <span className="block text-end">{t('table.actions')}</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const canResubmit = RESUBMITTABLE_STATUSES.has(row.original.zatcaStatus);
          return (
            <div className="text-end">
              {canResubmit ? (
                <ResubmitRowButton
                  invoiceId={row.original.invoiceId}
                  icv={row.original.icv}
                  onOpenResubmit={openResubmitDialog}
                  label={t('action.resubmit')}
                />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          );
        },
      },
    ],
    [t, openResubmitDialog],
  );

  const handleResubmitDialogChange = useCallback(
    (open: boolean) => {
      if (!open) closeResubmitDialog();
    },
    [closeResubmitDialog],
  );

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={refetchChain} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="me-1.5 size-3.5" aria-hidden="true" />
            )}
            {t('refresh')}
          </Button>
        </CardHeader>

        <CardContent className="pt-0">
          <DataTable
            columns={columns}
            data={entries}
            totalRows={entries.length}
            clientPagination
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onPageSizeChange={handlePageSizeChange}
            constrainHeight={false}
            hideDensityToggle
            entityLabel={t('title')}
            emptyTitle={t('emptyState')}
            noResultsTitle={t('emptyState')}
          />
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingResubmit} onOpenChange={handleResubmitDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="size-4" />
              {t('resubmitDialog.title', { icv: pendingResubmit?.icv ?? 0 })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('resubmitDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('resubmitDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={isResubmitPending} onClick={confirmResubmit}>
              {!!isResubmitPending && (
                <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
              )}
              {t('resubmitDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
