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
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';

import {
  EntityDetailItem,
  EntitySummarySheet,
} from '../table-kit/entity-summary-sheet.js';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { CheckCircle2, Download, FileUp, Lightbulb, XCircle } from 'lucide-react';
import { useCallback } from 'react';
import { useLocale } from '../../i18n/navigation.js';
import { useTranslations, type TranslateFn } from '../../i18n/useTranslations.js';
import { useDateFormatter } from '../../lib/format/use-date-formatter.js';
import { formatMinorUnits } from '../../lib/money.js';
import { formatRelativeDate } from '../../lib/format-relative-date.js';
import { useFlag } from '../layout/feature-flag-context.js';
import { BacsPreviewCard } from './bacs/bacs-preview-card.js';
import { usePaymentRunSidePanel } from './hooks/use-payment-run-side-panel.js';
import type { usePaymentRunSidePanel as UsePaymentRunSidePanel } from './hooks/use-payment-run-side-panel.js';
import { PaymentRunBadge } from './payment-run-badge.js';
import { PaymentRunItemRow } from './payment-run-item-row.js';
import { WhtSummaryCard } from './wht-summary-card.js';

interface PaymentRunSidePanelSkeletonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentRunSidePanelSkeleton({
  open,
  onOpenChange,
}: PaymentRunSidePanelSkeletonProps) {
  const t = useTranslations('Payments.sidePanel');

  return (
    <EntitySummarySheet
      open={open}
      onOpenChange={onOpenChange}
      sheetClassName="w-[400px]"
      title={t('loadingTitle')}
      titleVisuallyHidden>
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <div key={`payment-run-detail-skel-${i}`} className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`payment-run-item-skel-${i}`} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </EntitySummarySheet>
  );
}

type Panel = ReturnType<typeof UsePaymentRunSidePanel>;
type LoadedRun = NonNullable<Panel['run']>;

interface PaymentRunSidePanelViewProps {
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

export function PaymentRunSidePanelView({
  open,
  onOpenChange,
  onImportStatement,
  panel,
  showBacsPreview,
  t,
  locale,
  formatDate,
  skontoEnabled,
}: PaymentRunSidePanelViewProps) {
  const { run, safeRunId, status, items } = panel;

  const handleImportStatementClick = useCallback(
    () => onImportStatement?.(safeRunId),
    [onImportStatement, safeRunId],
  );

  return (
    <EntitySummarySheet
      open={open}
      onOpenChange={onOpenChange}
      sheetClassName="w-[400px]"
      title={run.runNumber ?? run.id.slice(0, 8)}
      badges={<PaymentRunBadge status={status} />}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <EntityDetailItem
          label={t('sidePanel.created')}
          value={formatRelativeDate(run.createdAt, locale)}
        />
        <EntityDetailItem label={t('sidePanel.exportFormat')} value={run.exportFormat ?? '—'} />
        <EntityDetailItem label={t('sidePanel.invoices')} value={String(run.invoiceCount)} />
        <EntityDetailItem
          label={t('sidePanel.total')}
          value={formatMinorUnits(run.totalMinor, run.currency, locale)}
          mono
        />
        {!!run.completedAt && (
          <EntityDetailItem
            label={t('sidePanel.completedDate')}
            value={formatDate(run.completedAt)}
          />
        )}
      </div>

      {panel.showFormatHint ? (
        <div className="mt-4">
          <DetectedFormatHint detectedFormatCounts={panel.detectedFormatCounts} t={t} />
        </div>
      ) : null}

      <Separator className="my-4" />

      <WhtSummaryCard paymentRunId={safeRunId} items={items} />

      <div className="flex flex-wrap gap-2 mt-4">
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

      <Separator className="my-4" />

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
          <Separator className="my-4" />
          <BacsPreviewCard paymentRunId={safeRunId} />
        </>
      ) : null}
    </EntitySummarySheet>
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

interface PaymentRunSidePanelProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportStatement?: (runId: string) => void;
}

export function PaymentRunSidePanel({
  runId,
  open,
  onOpenChange,
  onImportStatement,
}: PaymentRunSidePanelProps) {
  const t = useTranslations('Payments');
  const locale = useLocale();
  const { formatDate } = useDateFormatter();
  const bacsEnabled = useFlag('payments.bacs-enabled');
  const skontoEnabled = useFlag('payments.skonto-enabled');
  const panel = usePaymentRunSidePanel({ runId, open, onOpenChange });

  if (panel.isLoading || !panel.run) {
    return <PaymentRunSidePanelSkeleton open={open} onOpenChange={onOpenChange} />;
  }

  const exportFormat = panel.run.exportFormat as string | null | undefined;
  const showBacsPreview =
    bacsEnabled &&
    (exportFormat === 'BACS_STD18' ||
      panel.detectedFormatCounts.some(([format]) => format === 'BACS_STD18'));

  return (
    <PaymentRunSidePanelView
      open={open}
      onOpenChange={onOpenChange}
      onImportStatement={onImportStatement}
      panel={{ ...panel, run: panel.run }}
      showBacsPreview={showBacsPreview}
      t={t}
      locale={locale}
      formatDate={formatDate}
      skontoEnabled={skontoEnabled}
    />
  );
}

