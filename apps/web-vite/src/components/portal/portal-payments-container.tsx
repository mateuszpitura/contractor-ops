import {
  AtelierEmptyState,
  AtelierStatusPill,
  AtelierTableShell,
  PaymentsIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import type { KeyboardEvent, ReactNode } from 'react';
import { useCallback } from 'react';
import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { usePortalPayments } from './hooks/use-portal-payments.js';

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

interface PaymentRowProps {
  href: string;
  ariaLabel: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  paidAt: Date | string | null;
  paidLabel: string;
  formatDate: (value: Date | string | null | undefined) => string;
  onNavigate: (href: string) => void;
}

function PaymentRow({
  href,
  ariaLabel,
  invoiceNumber,
  amountMinor,
  currency,
  paidAt,
  paidLabel,
  formatDate,
  onNavigate,
}: PaymentRowProps) {
  const handleClick = useCallback(() => onNavigate(href), [onNavigate, href]);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigate(href);
      }
    },
    [onNavigate, href],
  );
  return (
    <TableRow
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      role="link"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}>
      <TableCell className="text-sm font-medium">{invoiceNumber}</TableCell>
      <TableCell className="text-sm">{formatAmount(amountMinor, currency)}</TableCell>
      <TableCell className="text-sm">{formatDate(paidAt)}</TableCell>
      <TableCell>
        <AtelierStatusPill variant="success">{paidLabel}</AtelierStatusPill>
      </TableCell>
    </TableRow>
  );
}

export function PortalPaymentsContainer() {
  const t = useTranslations('Portal');
  const router = useRouter();
  const { payments, isLoading } = usePortalPayments();
  const { formatDate } = usePortalDateFormatter();

  const handleNavigate = useCallback((href: string) => router.push(href), [router]);

  const columnHeaders = (
    <TableHeader>
      <TableRow>
        <TableHead>{t('payments.columns.invoiceNumber')}</TableHead>
        <TableHead>{t('payments.columns.amount')}</TableHead>
        <TableHead>{t('payments.columns.paymentDate')}</TableHead>
        <TableHead>{t('payments.columns.status')}</TableHead>
      </TableRow>
    </TableHeader>
  );

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div>
        <AtelierTableShell isLoading constrainHeight={false}>
          <Table>
            {columnHeaders}
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <TableRow key={`skel-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AtelierTableShell>
      </div>
    );
  } else if (payments && payments.length > 0) {
    body = (
      <div>
        <AtelierTableShell constrainHeight={false}>
          <Table>
            {columnHeaders}
            <TableBody>
              {payments.map(payment => {
                const href = `/portal/invoices/${payment.invoiceId}`;
                return (
                  <PaymentRow
                    key={payment.id}
                    href={href}
                    ariaLabel={`${t('payments.viewPayment')} ${payment.invoiceNumber}`}
                    invoiceNumber={payment.invoiceNumber}
                    amountMinor={payment.amountMinor}
                    currency={payment.currency}
                    paidAt={payment.paidAt}
                    paidLabel={t('payments.paid')}
                    formatDate={formatDate}
                    onNavigate={handleNavigate}
                  />
                );
              })}
            </TableBody>
          </Table>
        </AtelierTableShell>
      </div>
    );
  } else {
    body = (
      <AtelierEmptyState
        illustration={PaymentsIllustration}
        heading={t('payments.emptyTitle')}
        body={t('payments.emptyBody')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AnimateIn delay={0}>
        <WorkbenchPageHeader title={t('payments.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <SectionLabel variant="portal">{t('payments.title')}</SectionLabel>
      </AnimateIn>

      <AnimateIn delay={2}>{body}</AnimateIn>
    </div>
  );
}
