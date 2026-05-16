'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ZatcaBadgeStatus } from './zatca-status-badge';
import { ZatcaStatusBadge } from './zatca-status-badge';
import type { ZatcaChainEntry, ZatcaChainPage } from './zatca-trpc';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ZATCA Invoice Chain Table
// ---------------------------------------------------------------------------

interface ZatcaInvoiceChainTableProps {
  /** Page size; default 20. */
  pageSize?: number;
}

/**
 * Lists recent ZATCA submissions (most recent ICV first) with a per-row
 * "Resubmit" action gated behind an AlertDialog confirmation.
 *
 * Resubmission is only allowed by the server for `REJECTED` and `PENDING`
 * entries; we mirror that gate on the client and otherwise hide the button.
 *
 * Polls every 30s so freshly submitted invoices and cleared/rejected status
 * transitions show up without a manual refresh.
 */
export function ZatcaInvoiceChainTable({ pageSize = 20 }: ZatcaInvoiceChainTableProps) {
  const t = useTranslations('Zatca.invoiceChain');
  const queryClient = useQueryClient();

  const [pendingResubmit, setPendingResubmit] = useState<{
    invoiceId: string;
    icv: number;
  } | null>(null);

  const chainQuery = useQuery(
    zatcaTrpc.getInvoiceChain.queryOptions({ limit: pageSize }, { refetchInterval: 30_000 }),
  );

  const resubmitMutation = useMutation({
    ...zatcaTrpc.resubmit.mutationOptions(),
    onSuccess: () => {
      toast.success(t('toast.resubmitSuccess'));
      // Invalidate chain + stats + per-invoice status so polling catches up immediately
      queryClient.invalidateQueries({ queryKey: zatcaTrpc.getInvoiceChain.queryKey() });
      queryClient.invalidateQueries({ queryKey: zatcaTrpc.getComplianceStats.queryKey() });
      queryClient.invalidateQueries({ queryKey: zatcaTrpc.getStatus.queryKey() });
      setPendingResubmit(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.resubmitError'));
    },
  });

  function confirmResubmit() {
    if (!pendingResubmit) return;
    (resubmitMutation.mutate as unknown as (input: { invoiceId: string }) => void)({
      invoiceId: pendingResubmit.invoiceId,
    });
  }

  if (chainQuery.isLoading) {
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

  const page = chainQuery.data as ZatcaChainPage | undefined;
  const entries: ZatcaChainEntry[] = page?.entries ?? [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">{t('title')}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => chainQuery.refetch()}
            disabled={chainQuery.isFetching}>
            {chainQuery.isFetching ? (
              <Loader2 className="me-1.5 size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="me-1.5 size-3.5" aria-hidden="true" />
            )}
            {t('refresh')}
          </Button>
        </CardHeader>

        <CardContent className="pt-0">
          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">{t('emptyState')}</p>
            </div>
          ) : (
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
                              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                              onClick={() =>
                                setPendingResubmit({
                                  invoiceId: entry.invoiceId,
                                  icv: entry.icv,
                                })
                              }>
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
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!pendingResubmit}
        // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
        onOpenChange={open => {
          if (!open) setPendingResubmit(null);
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
            {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
            <AlertDialogAction disabled={resubmitMutation.isPending} onClick={confirmResubmit}>
              {!!resubmitMutation.isPending && (
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
