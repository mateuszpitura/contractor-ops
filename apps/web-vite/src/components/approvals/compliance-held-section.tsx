import { QueryErrorPanel } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { ShieldAlert } from 'lucide-react';
import { useCallback } from 'react';

import { Link, useLocale } from '../../i18n/navigation.js';
import type { LooseTranslator } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../lib/money.js';
import type { ComplianceHeldRow } from './hooks/use-compliance-held-approvals.js';

export interface ComplianceHeldSectionProps {
  items: ComplianceHeldRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  resumeTarget: ComplianceHeldRow | null;
  resumeReason: string;
  onResumeReasonChange: (value: string) => void;
  onOpenResume: (row: ComplianceHeldRow) => void;
  onCloseResume: () => void;
  onSubmitResume: () => void;
  isResuming: boolean;
}

function HeldRow({
  row,
  locale,
  onResume,
  t,
}: {
  row: ComplianceHeldRow;
  locale: string;
  onResume: (row: ComplianceHeldRow) => void;
  t: LooseTranslator;
}) {
  const handleResume = useCallback(() => onResume(row), [onResume, row]);
  const heldLabel = row.heldAt
    ? new Date(row.heldAt).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : t('heldUnknown');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-800 dark:text-amber-400">
            {t('statusBadge')}
          </Badge>
          {row.invoice ? (
            <Link
              href={`/invoices/${row.resourceId}`}
              className="font-mono text-sm text-primary hover:underline">
              {row.invoice.invoiceNumber}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">{t('unknownInvoice')}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {row.invoice?.contractor?.legalName ?? t('unknownContractor')}
          {row.invoice
            ? ` · ${formatMinorUnits(row.invoice.totalMinor, row.invoice.currency, locale)}`
            : null}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {t('heldSince', { date: heldLabel })}
          {row.heldItemIds.length > 0
            ? ` · ${t('holdingItems', { count: row.heldItemIds.length })}`
            : null}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={handleResume}>
        {t('resumeAction')}
      </Button>
    </div>
  );
}

export function ComplianceHeldSection({
  items,
  isLoading,
  isError,
  onRetry,
  resumeTarget,
  resumeReason,
  onResumeReasonChange,
  onOpenResume,
  onCloseResume,
  onSubmitResume,
  isResuming,
}: ComplianceHeldSectionProps) {
  const t = useTranslations('Approvals.complianceHold');
  const locale = useLocale();

  const handleReasonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onResumeReasonChange(e.target.value),
    [onResumeReasonChange],
  );
  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onCloseResume();
    },
    [onCloseResume],
  );

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-xl border border-border p-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <section
        aria-label={t('sectionTitle')}
        className="mb-4 space-y-3 rounded-xl border border-amber-500/20 bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
          <h3 className="text-sm font-medium text-foreground">{t('sectionTitle')}</h3>
        </div>
        <QueryErrorPanel
          message={t('error.message')}
          retryLabel={t('error.retry')}
          onRetry={onRetry}
        />
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <>
      <section
        aria-label={t('sectionTitle')}
        className="mb-4 space-y-3 rounded-xl border border-amber-500/20 bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
          <h3 className="text-sm font-medium text-foreground">{t('sectionTitle')}</h3>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
        <p className="text-[13px] text-muted-foreground">{t('sectionDescription')}</p>
        <div className="space-y-2">
          {items.map(row => (
            <HeldRow
              key={row.approvalFlowId}
              row={row}
              locale={locale}
              onResume={onOpenResume}
              t={t}
            />
          ))}
        </div>
      </section>

      <Dialog open={resumeTarget !== null} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('resumeDialog.title')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <p className="text-[13px] text-muted-foreground">{t('resumeDialog.description')}</p>
            <Textarea
              value={resumeReason}
              onChange={handleReasonChange}
              placeholder={t('resumeDialog.reasonPlaceholder')}
              className="min-h-[80px]"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={onCloseResume}>
              {t('resumeDialog.cancel')}
            </Button>
            <Button
              size="sm"
              disabled={resumeReason.trim().length < 1 || isResuming}
              onClick={onSubmitResume}>
              {t('resumeDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
