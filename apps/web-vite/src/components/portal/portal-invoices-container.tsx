import type { AtelierStatusVariant } from '@contractor-ops/ui';
import {
  AtelierEmptyState,
  AtelierStatusPill,
  AtelierTableShell,
  InvoicesIllustration,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { Plus } from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useCallback } from 'react';
import { Link, useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { AnimateIn } from '../shared/animate-in.js';
import { renderEmptyStateAction } from '../shared/atelier-bridges.js';
import { WorkbenchPageHeader } from '../shared/workbench-page-header.js';
import { usePortalInvoicesList } from './hooks/use-portal-invoices-list.js';

const stopPropagation = (e: MouseEvent) => e.stopPropagation();

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

type InvoiceStatusDisplay = {
  label: string;
  variant: AtelierStatusVariant;
};

function getStatusDisplay(
  invoice: {
    status: string;
    approvalStatus: string;
    paymentStatus: string;
  },
  t: ReturnType<typeof useTranslations>,
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

function InvoiceListSkeleton({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <>
      <div className="hidden md:block">
        <AtelierTableShell isLoading constrainHeight={false}>
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
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
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

function InvoicesEmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
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
      renderAction={renderEmptyStateAction}
    />
  );
}

interface InvoiceRowProps {
  href: string;
  ariaLabel: string;
  invoiceNumber: string;
  contractTitle: string | null | undefined;
  fallback: string;
  totalMinor: number;
  currency: string;
  receivedAt: Date | string | null | undefined;
  formatDate: (value: Date | string | null | undefined) => string;
  statusDisplay: InvoiceStatusDisplay;
  onNavigate: (href: string) => void;
}

function InvoiceRow({
  href,
  ariaLabel,
  invoiceNumber,
  contractTitle,
  fallback,
  totalMinor,
  currency,
  receivedAt,
  formatDate,
  statusDisplay,
  onNavigate,
}: InvoiceRowProps) {
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
      <TableCell>
        <Link
          href={href}
          className="font-medium text-primary hover:underline"
          onClick={stopPropagation}>
          {invoiceNumber}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{contractTitle ?? fallback}</TableCell>
      <TableCell>{formatAmount(totalMinor, currency)}</TableCell>
      <TableCell className="text-muted-foreground">
        {receivedAt ? formatDate(receivedAt) : fallback}
      </TableCell>
      <TableCell>
        <AtelierStatusPill variant={statusDisplay.variant}>{statusDisplay.label}</AtelierStatusPill>
      </TableCell>
    </TableRow>
  );
}

export function PortalInvoicesContainer() {
  const t = useTranslations('Portal');
  const { formatDate } = usePortalDateFormatter();
  const router = useRouter();
  const { invoices, isLoading } = usePortalInvoicesList();

  const handleNavigate = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={WORKBENCH_TABLE_PAGE_CLASS}>
      <AnimateIn delay={0}>
        <WorkbenchPageHeader
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

      <AnimateIn delay={1} className="flex min-h-0 flex-1 flex-col">
        <section className={WORKBENCH_TABLE_SECTION_CLASS}>
          <SectionLabel variant="portal">{t('invoices.title')}</SectionLabel>
          {isLoading ? (
            <InvoiceListSkeleton t={t} />
          ) : !invoices || invoices.length === 0 ? (
            <InvoicesEmptyState t={t} />
          ) : (
            <>
              <div className="hidden min-h-0 flex-1 flex-col md:flex">
                <AtelierTableShell isLoading={isLoading} constrainHeight={false}>
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
                        const href = `/portal/invoices/${invoice.id}`;
                        return (
                          <InvoiceRow
                            key={invoice.id}
                            href={href}
                            ariaLabel={`${t('invoices.viewInvoice')} ${invoice.invoiceNumber}`}
                            invoiceNumber={invoice.invoiceNumber}
                            contractTitle={invoice.contract?.title}
                            fallback={t('invoices.fallback')}
                            totalMinor={invoice.totalMinor}
                            currency={invoice.currency}
                            receivedAt={invoice.receivedAt}
                            formatDate={formatDate}
                            statusDisplay={statusDisplay}
                            onNavigate={handleNavigate}
                          />
                        );
                      })}
                    </TableBody>
                  </Table>
                </AtelierTableShell>
              </div>

              <div className="space-y-3 md:hidden">
                {invoices.map(invoice => {
                  const statusDisplay = getStatusDisplay(invoice, t);
                  return (
                    <Link
                      key={invoice.id}
                      href={`/portal/invoices/${invoice.id}`}
                      className="block">
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
        </section>
      </AnimateIn>
    </div>
  );
}
