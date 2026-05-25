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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Loader2, RefreshCw } from 'lucide-react';
import type { useZatcaInvoiceChainTable } from './hooks/use-zatca-invoice-chain-table.js';
import type { ZatcaBadgeStatus } from './zatca-status-badge.js';
import { ZatcaStatusBadge } from './zatca-status-badge.js';

const RESUBMITTABLE_STATUSES = new Set(['REJECTED', 'PENDING']);

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

export function ZatcaInvoiceChainTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
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
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t('table.icv')}</TableHead>
                  <TableHead>{t('table.invoice')}</TableHead>
                  <TableHead>{t('table.submitted')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead className="text-end">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => {
                  const canResubmit = RESUBMITTABLE_STATUSES.has(entry.zatcaStatus);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">{entry.icv}</TableCell>
                      <TableCell>
                        <span
                          className="font-mono text-xs"
                          title={entry.zatcaUuid || entry.invoiceId}>
                          {truncate(entry.zatcaUuid || entry.invoiceId)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.submittedAt ?? entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ZatcaStatusBadge status={entry.zatcaStatus as ZatcaBadgeStatus} />
                      </TableCell>
                      <TableCell className="text-end">
                        {canResubmit ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResubmitDialog(entry.invoiceId, entry.icv)}>
                            <RefreshCw className="me-1.5 size-3.5" aria-hidden="true" />
                            {t('action.resubmit')}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!pendingResubmit}
        onOpenChange={open => {
          if (!open) closeResubmitDialog();
        }}>
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
