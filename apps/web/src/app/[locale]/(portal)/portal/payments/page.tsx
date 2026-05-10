'use client';

import {
  AtelierEmptyState,
  AtelierPageHeader,
  AtelierStatusPill,
  AtelierTableShell,
} from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { portalTrpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal payments list page.
 *
 * Per UI-SPEC Payments List, PORT-04, and D-12:
 * - Table with Invoice Number, Amount, Payment Date, Status
 * - No internal batch IDs or org bank details exposed
 * - Click row to navigate to invoice detail
 * - Loading: table header + 3 row skeletons
 * - Empty state with specific copy from UI-SPEC
 */
export default function PortalPaymentsPage() {
  const t = useTranslations('Portal');
  const router = useRouter();
  const paymentsQuery = useQuery(portalTrpc.portal.listPayments.queryOptions());
  const payments = paymentsQuery.data;
  const isLoading = paymentsQuery.isPending;

  function formatDate(date: Date | string | null): string {
    if (!date) return t('time.na');
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }

  return (
    <div>
      <AnimateIn delay={0}>
        <AtelierPageHeader title={t('payments.title')} />
      </AnimateIn>

      <AnimateIn delay={1}>
        {isLoading ? (
          <div className="mt-6">
            <AtelierTableShell isLoading>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('payments.columns.invoiceNumber')}</TableHead>
                    <TableHead>{t('payments.columns.amount')}</TableHead>
                    <TableHead>{t('payments.columns.paymentDate')}</TableHead>
                    <TableHead>{t('payments.columns.status')}</TableHead>
                  </TableRow>
                </TableHeader>
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
        ) : payments && payments.length > 0 ? (
          <div className="mt-6">
            <AtelierTableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('payments.columns.invoiceNumber')}</TableHead>
                    <TableHead>{t('payments.columns.amount')}</TableHead>
                    <TableHead>{t('payments.columns.paymentDate')}</TableHead>
                    <TableHead>{t('payments.columns.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow
                      key={payment.id}
                      className="cursor-pointer"
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={() => router.push(`/portal/invoices/${payment.id}`)}>
                      <TableCell className="text-sm font-medium">{payment.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">
                        {formatAmount(payment.amountMinor, payment.currency)}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(payment.paidAt)}</TableCell>
                      <TableCell>
                        <AtelierStatusPill variant="success">
                          {t('payments.paid')}
                        </AtelierStatusPill>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AtelierTableShell>
          </div>
        ) : (
          <AtelierEmptyState
            icon={Banknote}
            heading={t('payments.emptyTitle')}
            body={t('payments.emptyBody')}
            renderAction={renderEmptyStateAction}
          />
        )}
      </AnimateIn>
    </div>
  );
}
