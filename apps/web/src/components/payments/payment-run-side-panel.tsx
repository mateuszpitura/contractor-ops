'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  FileUp,
  Lightbulb,
  MoreHorizontal,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { WhtSummaryCard } from '@/components/payments/wht-summary-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Bdi } from '@/components/ui/bdi';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useDoubleConfirmation } from '@/hooks/use-double-confirmation';
import { Link } from '@/i18n/navigation';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { formatMinorUnits } from '@/lib/format-currency';
import { formatRelativeDate } from '@/lib/format-relative-date';
import { trpc } from '@/trpc/init';
import { PaymentItemBadge, PaymentRunBadge } from './payment-run-badge';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentRunSidePanelProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportStatement?: (runId: string) => void;
}

// ---------------------------------------------------------------------------
// DetectedFormatHint — surfaces `payment.getFormatDetection` recommendations
// alongside the user's chosen export format so DRAFT runs can be sanity-
// checked before lock-and-export. Extracted so PaymentRunSidePanel stays
// below the cognitive-complexity ceiling.
// ---------------------------------------------------------------------------

function DetectedFormatHint({
  runId,
  enabled,
  t,
}: {
  runId: string;
  enabled: boolean;
  t: ReturnType<typeof useTranslations<'Payments'>>;
}) {
  const formatDetectionQuery = useQuery({
    ...trpc.payment.getFormatDetection.queryOptions({ paymentRunId: runId }),
    enabled,
  });
  const detectedFormatCounts = useMemo(() => {
    const detections = (formatDetectionQuery.data ?? []) as Array<{ format: string }>;
    const counts: Record<string, number> = {};
    for (const it of detections) {
      const key = it.format || 'UNKNOWN';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [formatDetectionQuery.data]);
  if (!enabled || detectedFormatCounts.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-[12px] font-medium text-foreground">
          {t('sidePanel.detectedFormatTitle')}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {detectedFormatCounts.map(([format, count]) => (
          <span
            key={format}
            className="inline-flex items-center gap-1 rounded-md bg-background border border-border px-1.5 py-0.5 text-[12px]">
            <span className="font-medium">{format}</span>
            <span className="text-muted-foreground tabular-nums">×{count}</span>
          </span>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">{t('sidePanel.detectedFormatHint')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentRunSidePanel({
  runId,
  open,
  onOpenChange,
  onImportStatement,
}: PaymentRunSidePanelProps) {
  const t = useTranslations('Payments');
  const locale = useLocale();
  const { formatDate } = useDateFormatter();
  const queryClient = useQueryClient();

  // Fetch run data
  const runQuery = useQuery({
    ...trpc.payment.get.queryOptions({ runId: runId ?? '' }),
    enabled: !!runId && open,
  });

  const run = runQuery.data;

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const invalidateQueries = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [['payment', 'get']],
    });
    void queryClient.invalidateQueries({
      queryKey: [['payment', 'list']],
    });
  }, [queryClient]);

  const markAllPaidMutation = useMutation(
    trpc.payment.markAllPaid.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.allMarkedPaid'));
        invalidateQueries();
      },
      onError: () => {
        toast.error(t('errors.failedToMarkPaid'));
      },
    }),
  );

  const cancelMutation = useMutation(
    trpc.payment.cancel.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.runCancelled'));
        invalidateQueries();
        onOpenChange(false);
      },
      onError: () => {
        toast.error(t('errors.failedToCancel'));
      },
    }),
  );

  const updateItemStatusMutation = useMutation(
    trpc.payment.updateItemStatus.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.itemUpdated'));
        invalidateQueries();
      },
      onError: () => {
        toast.error(t('errors.failedToUpdateItem'));
      },
    }),
  );

  const removeFromRunMutation = useMutation(
    trpc.payment.removeFromRun.mutationOptions({
      onSuccess: () => {
        toast.success(t('toast.removedFromRun'));
        invalidateQueries();
      },
      onError: () => {
        toast.error(t('errors.failedToRemove'));
      },
    }),
  );

  // ---------------------------------------------------------------------------
  // Mark all paid confirmation state
  // ---------------------------------------------------------------------------

  const { isConfirming: confirmMarkAll, handleClick: handleMarkAllPaid } = useDoubleConfirmation(
    useCallback(() => {
      if (runId) {
        markAllPaidMutation.mutate({ runId });
      }
    }, [runId, markAllPaidMutation]),
  );

  // ---------------------------------------------------------------------------
  // Download export
  // ---------------------------------------------------------------------------

  const handleDownloadExport = useCallback(async () => {
    if (!runId) return;
    // Re-fetch via lockAndExport if run is already exported -- use cached export
    // For simplicity, we can re-trigger the export to get the file
    // The actual download is handled via the lockAndExport response stored externally
    // For now, show a toast -- the actual download flow runs through the dialog
    toast.info(t('toast.downloadHint'));
  }, [runId, t]);

  if (!run) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] p-0">
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <div key={`skel-${i}`} className="h-4 bg-muted animate-pulse rounded w-full" />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // runId is guaranteed non-null here: query is only enabled when !!runId,
  // and we returned early above when !run (which requires runId to be truthy).
  const safeRunId = runId as string;

  const status = run.status as string;
  const items = (run.items ?? []) as unknown as Array<{
    id: string;
    invoiceId: string;
    amountMinor: number;
    currency: string;
    status: string;
    paymentReference: string | null;
    failureReason: string | null;
    invoice: { invoiceNumber: string; dueDate: string | null };
    contractor: { id: string; legalName: string };
  }>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Header */}
            <SheetHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-[20px] font-semibold leading-[1.2]">
                  {run.runNumber ?? run.id.slice(0, 8)}
                </SheetTitle>
                <PaymentRunBadge status={status} />
              </div>
            </SheetHeader>

            <Separator />

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailItem
                label={t('sidePanel.created')}
                value={formatRelativeDate(run.createdAt, locale)}
              />
              <DetailItem
                label={t('sidePanel.exportFormat')}
                value={run.exportFormat ?? '\u2014'}
              />
              <DetailItem label={t('sidePanel.invoices')} value={String(run.invoiceCount)} />
              <DetailItem
                label={t('sidePanel.total')}
                value={formatMinorUnits(run.totalMinor, run.currency, locale)}
                mono
              />
              {!!run.completedAt && (
                <DetailItem
                  label={t('sidePanel.completedDate')}
                  value={formatDate(run.completedAt)}
                />
              )}
            </div>

            {/* Auto-detected format hint — shown only while the run is still
                editable (DRAFT). After EXPORTED/LOCKED the chosen format is
                binding so the hint is suppressed to avoid noise. */}
            <DetectedFormatHint runId={safeRunId} enabled={status === 'DRAFT' && open} t={t} />

            <Separator />

            {/* WHT Summary (Phase 47) */}
            <WhtSummaryCard paymentRunId={safeRunId} items={items} />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {/* DRAFT actions */}
              {status === 'DRAFT' && (
                <CancelRunButton
                  status={status}
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onConfirm={() => cancelMutation.mutate({ runId: safeRunId })}
                  isLoading={cancelMutation.isPending}
                  t={t}
                />
              )}

              {/* EXPORTED actions */}
              {(status === 'EXPORTED' || status === 'LOCKED') && (
                <>
                  <Button variant="outline" size="sm" onClick={handleDownloadExport}>
                    <Download className="me-1.5 h-3.5 w-3.5" />
                    {t('sidePanel.downloadExport')}
                  </Button>
                  {status === 'EXPORTED' && (
                    <>
                      <Button
                        size="sm"
                        onClick={handleMarkAllPaid}
                        disabled={markAllPaidMutation.isPending}>
                        <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />
                        {confirmMarkAll
                          ? t('sidePanel.confirmMarkAllPaid')
                          : t('sidePanel.markAllPaid')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                        onClick={() => onImportStatement?.(safeRunId)}>
                        <FileUp className="me-1.5 h-3.5 w-3.5" />
                        {t('sidePanel.importStatement')}
                      </Button>
                    </>
                  )}
                  <CancelRunButton
                    status={status}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onConfirm={() => cancelMutation.mutate({ runId: safeRunId })}
                    isLoading={cancelMutation.isPending}
                    t={t}
                  />
                </>
              )}

              {/* COMPLETED actions */}
              {status === 'COMPLETED' && (
                <Button variant="outline" size="sm" onClick={handleDownloadExport}>
                  <Download className="me-1.5 h-3.5 w-3.5" />
                  {t('sidePanel.downloadExport')}
                </Button>
              )}
            </div>

            <Separator />

            {/* Invoice list */}
            <div className="space-y-2">
              <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                {t('sidePanel.invoices')}
              </h3>
              <div className="space-y-1">
                {items.map(item => (
                  <PaymentRunItemRow
                    key={item.id}
                    item={item}
                    runStatus={status}
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onUpdateStatus={(itemId, itemStatus, ref, reason) =>
                      updateItemStatusMutation.mutate({
                        itemId,
                        status: itemStatus,
                        paymentReference: ref || undefined,
                        failureReason: reason || undefined,
                      })
                    }
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onRemoveFromRun={invoiceId =>
                      removeFromRunMutation.mutate({
                        runId: safeRunId,
                        invoiceId,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Cancel run button with AlertDialog
// ---------------------------------------------------------------------------

function CancelRunButton({
  status,
  onConfirm,
  isLoading,
  t,
}: {
  status: string;
  onConfirm: () => void;
  isLoading: boolean;
  t: ReturnType<typeof useTranslations<'Payments'>>;
}) {
  const isExported = status === 'EXPORTED';
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="outline" size="sm" className="text-destructive" />}>
        <XCircle className="me-1.5 h-3.5 w-3.5" />
        {t('sidePanel.cancelRun')}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <XCircle className="size-4" />
            {isExported ? t('cancelDialog.exportedTitle') : t('cancelDialog.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isExported ? t('cancelDialog.exportedBody') : t('cancelDialog.body')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancelDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading} variant="destructive">
            {t('cancelDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Payment run item row
// ---------------------------------------------------------------------------

function PaymentRunItemRow({
  item,
  runStatus,
  onUpdateStatus,
  onRemoveFromRun,
}: {
  item: {
    id: string;
    invoiceId: string;
    amountMinor: number;
    currency: string;
    status: string;
    paymentReference: string | null;
    invoice: { invoiceNumber: string };
    contractor: { id: string; legalName: string };
  };
  runStatus: string;
  onUpdateStatus: (
    itemId: string,
    status: 'PAID' | 'FAILED',
    reference?: string,
    reason?: string,
  ) => void;
  onRemoveFromRun: (invoiceId: string) => void;
}) {
  const t = useTranslations('Payments');
  const locale = useLocale();
  const isTerminal = item.status === 'PAID' || item.status === 'FAILED';
  const isDraft = runStatus === 'DRAFT';

  // Inline form state for mark paid/failed
  const [activeAction, setActiveAction] = useState<'paid' | 'failed' | 'remove' | null>(null);
  const [reference, setReference] = useState('');
  const [failureReason, setFailureReason] = useState('');

  return (
    <div className="py-2 px-2 rounded hover:bg-muted/50 text-sm">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/invoices/${item.invoiceId}`}
              className="text-primary hover:underline text-xs font-medium truncate"
              // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
              onClick={e => e.stopPropagation()}>
              <Bdi>{item.invoice.invoiceNumber}</Bdi>
            </Link>
            <PaymentItemBadge status={item.status} />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            <Bdi>{item.contractor.legalName}</Bdi>
          </p>
          {!!item.paymentReference && (
            <p className="text-[12px] text-muted-foreground">
              {t('paymentRef', { reference: item.paymentReference })}
            </p>
          )}
        </div>
        <span className="font-mono text-xs tabular-nums whitespace-nowrap">
          {formatMinorUnits(item.amountMinor, item.currency, locale)}
        </span>

        {/* Per-item actions */}
        {(!isTerminal || isDraft) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
              render={props => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={e => {
                    e.stopPropagation();
                    props.onClick?.(e);
                  }}>
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {!isTerminal && (
                <>
                  {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                  <DropdownMenuItem onClick={() => setActiveAction('paid')}>
                    <CheckCircle2 className="me-2 h-4 w-4" />
                    {t('sidePanel.markPaid')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                    onClick={() => setActiveAction('failed')}>
                    <XCircle className="me-2 h-4 w-4" />
                    {t('sidePanel.markFailed')}
                  </DropdownMenuItem>
                </>
              )}
              {isDraft && (
                <DropdownMenuItem
                  className="text-destructive"
                  // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                  onClick={() => setActiveAction('remove')}>
                  <Trash2 className="me-2 h-4 w-4" />
                  {t('sidePanel.removeFromRun')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Inline form for mark paid */}
      {activeAction === 'paid' && (
        <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
          <Label className="text-xs">{t('sidePanel.referenceLabel')}</Label>
          <Input
            placeholder={t('sidePanel.referencePlaceholder')}
            value={reference}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setReference(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-6 text-xs flex-1"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                onUpdateStatus(item.id, 'PAID', reference || undefined);
                setActiveAction(null);
                setReference('');
              }}>
              {t('sidePanel.confirm')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                setActiveAction(null);
                setReference('');
              }}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Inline form for mark failed */}
      {activeAction === 'failed' && (
        <div className="mt-2 p-2 rounded border bg-muted/30 space-y-2">
          <Label className="text-xs">{t('sidePanel.failureReasonLabel')}</Label>
          <Textarea
            placeholder={t('sidePanel.failureReasonPlaceholder')}
            value={failureReason}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setFailureReason(e.target.value)}
            className="h-14 text-xs resize-none"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs flex-1"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                if (failureReason.trim()) {
                  onUpdateStatus(item.id, 'FAILED', undefined, failureReason.trim());
                  setActiveAction(null);
                  setFailureReason('');
                }
              }}
              disabled={!failureReason.trim()}>
              {t('sidePanel.confirm')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                setActiveAction(null);
                setFailureReason('');
              }}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Inline confirm for remove from run */}
      {activeAction === 'remove' && (
        <div className="mt-2 p-2 rounded border bg-destructive/5 space-y-2">
          <p className="text-xs text-muted-foreground">{t('sidePanel.removeFromRunConfirm')}</p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs flex-1"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => {
                onRemoveFromRun(item.invoiceId);
                setActiveAction(null);
              }}>
              {t('sidePanel.removeButton')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={() => setActiveAction(null)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mark paid/failed/remove actions are now handled via dropdown items
// that trigger the action directly. For mark paid, we use a simple
// one-click approach (reference can be added later). For mark failed,
// we use an inline form below the item row via state.

// ---------------------------------------------------------------------------
// Detail item
// ---------------------------------------------------------------------------

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-[13px]' : 'text-sm'}>
        {value ?? <span className="text-muted-foreground">&mdash;</span>}
      </dd>
    </div>
  );
}
