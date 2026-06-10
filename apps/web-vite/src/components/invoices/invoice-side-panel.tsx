import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Mail, Upload } from 'lucide-react';
import { Link } from '../../i18n/navigation.js';
import { tDynLoose } from '../../i18n/typed-keys.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { enumKey } from '../../lib/enum-key.js';
import { formatDate } from '../../lib/format-date.js';
import { formatMinorUnits } from '../../lib/money.js';
import { EntityDetailItem, EntitySummarySheet } from '../table-kit/entity-summary-sheet.js';
import type { InvoiceRow } from './invoice-table/columns.js';

const statusBadgeColors: Record<string, string> = {
  RECEIVED: 'bg-muted text-muted-foreground',
  MATCHED: 'bg-green-500/10 text-green-800 dark:text-green-400',
  UNMATCHED: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  DISCREPANCY: 'bg-red-500/10 text-red-600 dark:text-red-400',
  APPROVAL_PENDING: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  APPROVED: 'bg-green-500/10 text-green-800 dark:text-green-400',
  REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  READY_FOR_PAYMENT: 'bg-primary/10 text-primary',
  PAID: 'bg-muted text-muted-foreground',
  UNDER_REVIEW: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  VOID: 'bg-muted text-muted-foreground',
};

const matchStatusConfig: Record<string, { dotClass: string; labelKey: string }> = {
  MATCHED: { dotClass: 'bg-green-500', labelKey: 'strongMatch' },
  PARTIAL: { dotClass: 'bg-amber-500', labelKey: 'partialMatch' },
  DISCREPANCY: { dotClass: 'bg-red-500', labelKey: 'discrepancy' },
  UNMATCHED: { dotClass: 'bg-muted-foreground', labelKey: 'unmatched' },
  MANUALLY_CONFIRMED: { dotClass: 'bg-blue-500', labelKey: 'manualMatch' },
};

const NON_OVERDUE_STATUSES = new Set(['PAID', 'VOID']);

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || NON_OVERDUE_STATUSES.has(status)) return false;
  return new Date(dueDate) < new Date();
}

interface InvoiceSidePanelProps {
  invoice: InvoiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceSidePanel({ invoice, open, onOpenChange }: InvoiceSidePanelProps) {
  const t = useTranslations('Invoices');
  const ts = useTranslations('Invoices.sidePanel');

  if (!invoice) return null;

  const matchConfig = matchStatusConfig[invoice.matchStatus];
  const overdue = isOverdue(invoice.dueDate, invoice.status);

  return (
    <EntitySummarySheet
      open={open}
      onOpenChange={onOpenChange}
      title={invoice.invoiceNumber}
      badges={
        <>
          <Badge variant="secondary" className={statusBadgeColors[invoice.status] ?? ''}>
            {tDynLoose(t, 'status', enumKey(invoice.status))}
          </Badge>
          {invoice.source === 'MANUAL_UPLOAD' ? (
            <Upload className="h-4 w-4 text-muted-foreground" />
          ) : invoice.source === 'EMAIL_INTAKE' ? (
            <Mail className="h-4 w-4 text-muted-foreground" />
          ) : null}
        </>
      }
      footer={
        <Button render={<Link href={`/invoices/${invoice.id}`} />} className="w-full">
          {ts('openInvoice')}
        </Button>
      }>
      <div className="space-y-3">
        <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
          {ts('amounts')}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <EntityDetailItem
            label={ts('net')}
            value={formatMinorUnits(invoice.subtotalMinor, null, 'pl-PL')}
            mono
          />
          <EntityDetailItem
            label={ts('gross')}
            value={formatMinorUnits(invoice.totalMinor, null, 'pl-PL')}
            mono
          />
          <EntityDetailItem label={t('columns.currency')} value={invoice.currency} />
        </div>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
          {ts('dates')}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <EntityDetailItem
            label={t('columns.issueDate')}
            value={invoice.issueDate ? formatDate(invoice.issueDate) : null}
          />
          <div className="space-y-1">
            <dt className="text-[13px] text-muted-foreground">{t('columns.dueDate')}</dt>
            <dd className={overdue ? 'text-destructive font-medium' : ''}>
              {invoice.dueDate ? formatDate(invoice.dueDate) : '\u2014'}
            </dd>
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <h3 className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">
          {ts('matching')}
        </h3>
        <div className="flex items-center gap-2 text-sm">
          {matchConfig ? (
            <>
              <span className={`inline-block h-2 w-2 rounded-full ${matchConfig.dotClass}`} />
              <span>{tDynLoose(t, 'matchStatus', enumKey(matchConfig.labelKey))}</span>
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
    </EntitySummarySheet>
  );
}
