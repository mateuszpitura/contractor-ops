'use client';

import { Mail, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Link } from '@/i18n/navigation';
import type { InvoiceRow } from './invoice-table/columns';
import { enumKey } from '@/lib/enum-key';

// ---------------------------------------------------------------------------
// Status badge colors (mirrors columns.tsx)
// ---------------------------------------------------------------------------

const statusBadgeColors: Record<string, string> = {
  RECEIVED: 'bg-muted text-muted-foreground',
  MATCHED: 'bg-green-500/10 text-green-600 dark:text-green-400',
  UNMATCHED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DISCREPANCY: 'bg-red-500/10 text-red-600 dark:text-red-400',
  APPROVAL_PENDING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  APPROVED: 'bg-green-500/10 text-green-600 dark:text-green-400',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  READY_FOR_PAYMENT: 'bg-primary/10 text-primary',
  PAID: 'bg-muted text-muted-foreground',
  UNDER_REVIEW: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  VOID: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Match status indicator
// ---------------------------------------------------------------------------

const matchStatusConfig: Record<string, { dotClass: string; labelKey: string }> = {
  MATCHED: { dotClass: 'bg-green-500', labelKey: 'strongMatch' },
  PARTIAL: { dotClass: 'bg-amber-500', labelKey: 'partialMatch' },
  DISCREPANCY: { dotClass: 'bg-red-500', labelKey: 'discrepancy' },
  UNMATCHED: { dotClass: 'bg-muted-foreground', labelKey: 'unmatched' },
  MANUALLY_CONFIRMED: { dotClass: 'bg-blue-500', labelKey: 'manualMatch' },
};

// ---------------------------------------------------------------------------
// Currency / minor-unit formatter
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Overdue detection
// ---------------------------------------------------------------------------

const NON_OVERDUE_STATUSES = new Set(['PAID', 'VOID']);

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || NON_OVERDUE_STATUSES.has(status)) return false;
  return new Date(dueDate) < new Date();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InvoiceSidePanelProps {
  invoice: InvoiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-out side panel showing invoice summary.
 * Opens from right on row click. 480px on desktop, 400px on tablet.
 */
export function InvoiceSidePanel({ invoice, open, onOpenChange }: InvoiceSidePanelProps) {
  const t = useTranslations('Invoices');
  const ts = useTranslations('Invoices.sidePanel');

  if (!invoice) return null;

  const matchConfig = matchStatusConfig[invoice.matchStatus];
  const overdue = isOverdue(invoice.dueDate, invoice.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {/* Header */}
            <SheetHeader className="space-y-3">
              <SheetTitle className="font-mono text-[20px] font-semibold leading-[1.2]">
                {invoice.invoiceNumber}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={statusBadgeColors[invoice.status] ?? ''}>
                  {t(`status.${enumKey(invoice.status)}` as Parameters<typeof t>[0])}
                </Badge>
                {invoice.source === 'MANUAL_UPLOAD' ? (
                  <Upload className="h-4 w-4 text-muted-foreground" />
                ) : invoice.source === 'EMAIL_INTAKE' ? (
                  <Mail className="h-4 w-4 text-muted-foreground" />
                ) : null}
              </div>
            </SheetHeader>

            <Separator />

            {/* Amounts section */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                {ts('amounts')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem
                  label={ts('net')}
                  value={formatMinorUnits(invoice.subtotalMinor)}
                  mono
                />
                <DetailItem label={ts('gross')} value={formatMinorUnits(invoice.totalMinor)} mono />
                <DetailItem label={t('columns.currency')} value={invoice.currency} />
              </div>
            </div>

            <Separator />

            {/* Dates section */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                {ts('dates')}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem
                  label={t('columns.issueDate')}
                  value={
                    invoice.issueDate
                      ? new Date(invoice.issueDate).toLocaleDateString('pl-PL')
                      : null
                  }
                />
                <div className="space-y-1">
                  <dt className="text-[13px] text-muted-foreground">{t('columns.dueDate')}</dt>
                  <dd className={overdue ? 'text-destructive font-medium' : ''}>
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString('pl-PL')
                      : '\u2014'}
                  </dd>
                </div>
              </div>
            </div>

            <Separator />

            {/* Matching section */}
            <div className="space-y-3">
              <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
                {ts('matching')}
              </h3>
              <div className="flex items-center gap-2 text-sm">
                {matchConfig ? (
                  <>
                    <span className={`inline-block h-2 w-2 rounded-full ${matchConfig.dotClass}`} />
                    <span>
                      {t(`matchStatus.${enumKey(matchConfig.labelKey)}` as Parameters<typeof t>[0])}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">&mdash;</span>
                )}
              </div>
              {!!invoice.contractor && (
                <Link
                  href={`/contractors/${invoice.contractor.id}`}
                  className="text-sm text-primary hover:underline">
                  {invoice.contractor.legalName}
                </Link>
              )}
            </div>

            <Separator />

            {/* Open full invoice CTA */}
            <Button render={<Link href={`/invoices/${invoice.id}`} />} className="w-full">
              {ts('openInvoice')}
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

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
      <dd className={mono ? 'font-mono text-[13px]' : ''}>
        {value ?? <span className="text-muted-foreground">&mdash;</span>}
      </dd>
    </div>
  );
}
