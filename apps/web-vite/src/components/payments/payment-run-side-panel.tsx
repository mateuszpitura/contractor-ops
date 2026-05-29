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
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ScrollArea } from '@contractor-ops/ui/components/shadcn/scroll-area';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@contractor-ops/ui/components/shadcn/sheet';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { CheckCircle2, Download, FileUp, Lightbulb, XCircle } from 'lucide-react';
import { useCallback } from 'react';

import type { TranslateFn } from '../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../lib/format-currency.js';
import { formatRelativeDate } from '../../lib/format-relative-date.js';
import { BacsPreviewCardContainer } from './bacs/bacs-preview-card-container.js';
import type { usePaymentRunSidePanel } from './hooks/use-payment-run-side-panel.js';
import { PaymentRunBadge } from './payment-run-badge.js';
import { PaymentRunItemRow } from './payment-run-item-row.js';
import { WhtSummaryCardContainer } from './wht-summary-card-container.js';

interface PaymentRunSidePanelSkeletonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentRunSidePanelSkeleton({
  open,
  onOpenChange,
}: PaymentRunSidePanelSkeletonProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader className="space-y-3">
              <SheetTitle className="sr-only">Loading payment run</SheetTitle>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </SheetHeader>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <div key={`payment-run-detail-skel-${i}`} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={`payment-run-item-skel-${i}`} className="h-12 w-full rounded-md" />
              ))}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

type Panel = ReturnType<typeof usePaymentRunSidePanel>;
type LoadedRun = NonNullable<Panel['run']>;

interface PaymentRunSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportStatement?: (runId: string) => void;
  panel: Omit<Panel, 'run'> & { run: LoadedRun };
  showBacsPreview: boolean;
  t: TranslateFn;
  locale: string;
  formatDate: (value: Date | string) => string;
  skontoEnabled: boolean;
}

function DetectedFormatHint({
  detectedFormatCounts,
  t,
}: {
  detectedFormatCounts: [string, number][];
  t: TranslateFn;
}) {
  if (detectedFormatCounts.length === 0) return null;
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

export function PaymentRunSidePanel({
  open,
  onOpenChange,
  onImportStatement,
  panel,
  showBacsPreview,
  t,
  locale,
  formatDate,
  skontoEnabled,
}: PaymentRunSidePanelProps) {
  const { run, safeRunId, status, items } = panel;

  const handleImportStatementClick = useCallback(
    () => onImportStatement?.(safeRunId),
    [onImportStatement, safeRunId],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <SheetHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-[20px] font-semibold leading-[1.2]">
                  {run.runNumber ?? run.id.slice(0, 8)}
                </SheetTitle>
                <PaymentRunBadge status={status} />
              </div>
            </SheetHeader>

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailItem
                label={t('sidePanel.created')}
                value={formatRelativeDate(run.createdAt, locale)}
              />
              <DetailItem label={t('sidePanel.exportFormat')} value={run.exportFormat ?? '—'} />
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

            {panel.showFormatHint && (
              <DetectedFormatHint detectedFormatCounts={panel.detectedFormatCounts} t={t} />
            )}

            <Separator />

            <WhtSummaryCardContainer paymentRunId={safeRunId} items={items} />

            <div className="flex flex-wrap gap-2">
              {status === 'DRAFT' && (
                <CancelRunButton
                  status={status}
                  onConfirm={panel.onCancelRun}
                  isLoading={panel.isCancelPending}
                  t={t}
                />
              )}

              {(status === 'EXPORTED' || status === 'LOCKED') && (
                <>
                  <Button variant="outline" size="sm" onClick={panel.handleDownloadExport}>
                    <Download className="me-1.5 h-3.5 w-3.5" />
                    {t('sidePanel.downloadExport')}
                  </Button>
                  {status === 'EXPORTED' && (
                    <>
                      <Button
                        size="sm"
                        onClick={panel.handleMarkAllPaid}
                        disabled={panel.isMarkAllPaidPending}>
                        <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />
                        {panel.confirmMarkAll
                          ? t('sidePanel.confirmMarkAllPaid')
                          : t('sidePanel.markAllPaid')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleImportStatementClick}>
                        <FileUp className="me-1.5 h-3.5 w-3.5" />
                        {t('sidePanel.importStatement')}
                      </Button>
                    </>
                  )}
                  <CancelRunButton
                    status={status}
                    onConfirm={panel.onCancelRun}
                    isLoading={panel.isCancelPending}
                    t={t}
                  />
                </>
              )}

              {status === 'COMPLETED' && (
                <Button variant="outline" size="sm" onClick={panel.handleDownloadExport}>
                  <Download className="me-1.5 h-3.5 w-3.5" />
                  {t('sidePanel.downloadExport')}
                </Button>
              )}
            </div>

            <Separator />

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
                    skontoEnabled={skontoEnabled}
                    onUpdateStatus={panel.onUpdateItemStatus}
                    onRemoveFromRun={panel.onRemoveFromRun}
                    isUpdating={panel.isUpdatingItem}
                    isRemoving={panel.isRemovingItem}
                  />
                ))}
              </div>
            </div>

            {showBacsPreview ? (
              <>
                <Separator />
                <BacsPreviewCardContainer paymentRunId={safeRunId} />
              </>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function CancelRunButton({
  status,
  onConfirm,
  isLoading,
  t,
}: {
  status: string;
  onConfirm: () => void;
  isLoading: boolean;
  t: TranslateFn;
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
