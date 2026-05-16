'use client';

import type { AtelierStatusVariant } from '@contractor-ops/ui';
import {
  AtelierEmptyState,
  AtelierPageHeader,
  AtelierStatusPill,
  AtelierTableShell,
  InvoicesIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AnimateIn } from '@/components/shared/animate-in';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import { usePortalDateFormatter } from '@/lib/format/use-portal-date-formatter';
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
// Status badge mapping
// ---------------------------------------------------------------------------

type InvoiceStatusDisplay = {
  label: string;
  variant: AtelierStatusVariant;
};

// Multi-field rollup: portal status reflects payment > approval > status,
// surfacing the most-advanced lifecycle stage to the contractor. Variants
// map to the @contractor-ops/ui 8-token semantic system.
function getStatusDisplay(
  invoice: {
    status: string;
    approvalStatus: string;
    paymentStatus: string;
  },
  t: ReturnType<typeof useTranslations<'Portal'>>,
): InvoiceStatusDisplay {
  if (invoice.paymentStatus === 'PAID')
    return { label: t('invoices.status.paid'), variant: 'success' };
  if (invoice.paymentStatus === 'IN_RUN')
    return { label: t('invoices.status.paymentScheduled'), variant: 'live' };
  if (invoice.approvalStatus === 'APPROVED')
    return { label: t('invoices.status.approved'), variant: 'success' };
  if (invoice.status === 'REJECTED')
    return { label: t('invoices.status.rejected'), variant: 'danger' };
  if (invoice.status === 'UNDER_REVIEW' || invoice.status === 'APPROVAL_PENDING')
    return { label: t('invoices.status.inReview'), variant: 'warning' };
  return { label: t('invoices.status.submitted'), variant: 'info' };
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function InvoiceListSkeleton({ t }: { t: ReturnType<typeof useTranslations<'Portal'>> }) {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="hidden md:block">
        <AtelierTableShell isLoading>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoices.columns.invoiceNumber')}</TableHead>
                <TableHead>{t('invoices.columns.contract')}</TableHead>
                <TableHead>{t('invoices.columns.amount')}</TableHead>
                <TableHead>{t('invoices.columns.dateSubmitted')}</TableHead>
                <TableHead>{t('invoices.columns.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <TableRow key={`skel-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AtelierTableShell>
      </div>
      {/* Mobile skeleton */}
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Card key={`skel-${i}`}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-36" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function InvoicesEmptyState({ t }: { t: ReturnType<typeof useTranslations<'Portal'>> }) {
  return (
    <AtelierEmptyState
      illustration={InvoicesIllustration}
      heading={t('invoices.emptyTitle')}
      body={t('invoices.emptyBody')}
      primaryAction={{
        label: t('invoices.submitInvoice'),
        href: '/portal/invoices/submit',
        icon: Plus,
      }}
      renderAction={action =>
        action.href ? (
          <Link href={action.href}>
            <Button>
              {action.icon ? <action.icon className="me-1.5 h-4 w-4" /> : null}
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button onClick={action.onClick}>
            {action.icon ? <action.icon className="me-1.5 h-4 w-4" /> : null}
            {action.label}
          </Button>
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PortalInvoicesPage() {
  const t = useTranslations('Portal');
  const { formatDate } = usePortalDateFormatter();
  const router = useRouter();

  const { data: invoices, isLoading } = useQuery(portalTrpc.portal.listInvoices.queryOptions());

  return (
    <div className="space-y-6">
      {/* Header */}
      <AnimateIn delay={0}>
        <AtelierPageHeader
          title={t('invoices.title')}
          actions={
            <Link href="/portal/invoices/submit">
              <Button>
                <Plus className="me-1.5 h-4 w-4" />
                {t('invoices.submitInvoice')}
              </Button>
            </Link>
          }
        />
      </AnimateIn>

      {/* Content */}
      <AnimateIn delay={1}>
        <SectionLabel variant="portal">{t('invoices.title')}</SectionLabel>
      </AnimateIn>

      <AnimateIn delay={2}>
        {isLoading ? (
          <InvoiceListSkeleton t={t} />
        ) : !invoices || invoices.length === 0 ? (
          <InvoicesEmptyState t={t} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <AtelierTableShell isLoading={isLoading}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('invoices.columns.invoiceNumber')}</TableHead>
                      <TableHead>{t('invoices.columns.contract')}</TableHead>
                      <TableHead>{t('invoices.columns.amount')}</TableHead>
                      <TableHead>{t('invoices.columns.dateSubmitted')}</TableHead>
                      <TableHead>{t('invoices.columns.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(invoice => {
                      const statusDisplay = getStatusDisplay(invoice, t);
                      return (
                        <TableRow
                          key={invoice.id}
                          className="cursor-pointer"
                          // biome-ignore lint/nursery/noJsxPropsBind: dynamic route per list item
                          onClick={() => router.push(`/portal/invoices/${invoice.id}`)}>
                          <TableCell>
                            <Link
                              href={`/portal/invoices/${invoice.id}`}
                              className="font-medium text-primary hover:underline"
                              // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler in list
                              onClick={e => e.stopPropagation()}>
                              {invoice.invoiceNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {invoice.contract?.title ?? t('invoices.fallback')}
                          </TableCell>
                          <TableCell>
                            {formatAmount(invoice.totalMinor, invoice.currency)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {invoice.receivedAt
                              ? formatDate(invoice.receivedAt)
                              : t('invoices.fallback')}
                          </TableCell>
                          <TableCell>
                            <AtelierStatusPill variant={statusDisplay.variant}>
                              {statusDisplay.label}
                            </AtelierStatusPill>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AtelierTableShell>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {invoices.map(invoice => {
                const statusDisplay = getStatusDisplay(invoice, t);
                return (
                  <Link key={invoice.id} href={`/portal/invoices/${invoice.id}`} className="block">
                    <Card className="transition-colors hover:bg-muted/50">
                      <CardContent className="space-y-2 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{invoice.invoiceNumber}</span>
                          <span className="text-sm font-medium">
                            {formatAmount(invoice.totalMinor, invoice.currency)}
                          </span>
                        </div>
                        <p className="text-[13px] text-muted-foreground">
                          {invoice.contract?.title ?? t('invoices.fallback')}
                        </p>
                        <div className="flex items-center justify-between">
                          <AtelierStatusPill variant={statusDisplay.variant}>
                            {statusDisplay.label}
                          </AtelierStatusPill>
                          <span className="text-[13px] text-muted-foreground">
                            {invoice.receivedAt
                              ? formatDate(invoice.receivedAt)
                              : t('invoices.fallback')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </AnimateIn>
    </div>
  );
}
