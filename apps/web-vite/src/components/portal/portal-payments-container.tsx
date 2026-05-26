import {
  AtelierEmptyState,
  AtelierPageHeader,
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
import type { ReactNode } from 'react';

import { useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { usePortalPayments } from './hooks/use-portal-payments.js';

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function PortalPaymentsContainer() {
  const t = useTranslations('Portal');
  const router = useRouter();
  const { payments, isLoading } = usePortalPayments();
  const { formatDate } = usePortalDateFormatter();

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
                  <TableRow
                    key={payment.id}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    role="link"
                    tabIndex={0}
                    aria-label={`${t('payments.viewPayment')} ${payment.invoiceNumber}`}
                    onClick={() => router.push(href)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(href);
                      }
                    }}>
                    <TableCell className="text-sm font-medium">{payment.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">
                      {formatAmount(payment.amountMinor, payment.currency)}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(payment.paidAt)}</TableCell>
                    <TableCell>
                      <AtelierStatusPill variant="success">{t('payments.paid')}</AtelierStatusPill>
                    </TableCell>
                  </TableRow>
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
        <AtelierPageHeader title={t('payments.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        <SectionLabel variant="portal">{t('payments.title')}</SectionLabel>
      </AnimateIn>

      <AnimateIn delay={2}>{body}</AnimateIn>
    </div>
  );
}
