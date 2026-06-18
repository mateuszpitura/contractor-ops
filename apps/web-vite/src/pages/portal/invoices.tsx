/**
 * Portal invoices list — route shell with inlined page content.
 */

import {
  AtelierStatusPill,
  InvoicesIllustration,
  resolvePortalInvoiceStatusDisplay,
  SectionLabel,
  WORKBENCH_TABLE_PAGE_CLASS,
  WORKBENCH_TABLE_SECTION_CLASS,
} from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Suspense, useCallback, useMemo } from 'react';

import { usePortalInvoicesList } from '../../components/portal/hooks/use-portal-invoices-list.js';
import { AnimateIn } from '../../components/shared/animate-in.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { WorkbenchPageHeader } from '../../components/shared/workbench-page-header.js';
import { WorkbenchDataTable } from '../../components/table-kit/workbench-data-table.js';
import { Link, useRouter } from '../../i18n/navigation.js';
import { useTranslations } from '../../i18n/useTranslations.js';
import { usePortalDateFormatter } from '../../lib/format/use-portal-date-formatter.js';
import { formatMoneyAmount } from '../../lib/money.js';

const stopPropagation = (e: MouseEvent) => e.stopPropagation();
const noop = () => undefined;
const getInvoiceRowId = (row: InvoiceRow) => row.id;

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  contract?: { title?: string | null } | null;
  totalMinor: number;
  currency: string;
  receivedAt: Date | string | null | undefined;
  status: string;
  approvalStatus: string;
  paymentStatus: string;
}

function PortalInvoicesPageContent() {
  const t = useTranslations('Portal');
  const { formatDate } = usePortalDateFormatter();
  const router = useRouter();
  const { invoices, isLoading } = usePortalInvoicesList();

  const handleNavigate = useCallback((href: string) => router.push(href), [router]);

  const rows = (invoices ?? []) as InvoiceRow[];

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        id: 'invoiceNumber',
        header: () => t('invoices.columns.invoiceNumber'),
        cell: ({ row }) => (
          <Link
            href={`/portal/invoices/${row.original.id}`}
            className="font-medium text-primary hover:underline"
            onClick={stopPropagation}>
            {row.original.invoiceNumber}
          </Link>
        ),
      },
      {
        id: 'contract',
        header: () => t('invoices.columns.contract'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.contract?.title ?? t('invoices.fallback')}
          </span>
        ),
      },
      {
        id: 'amount',
        header: () => t('invoices.columns.amount'),
        cell: ({ row }) =>
          formatMoneyAmount(row.original.totalMinor, row.original.currency, 'en-US'),
      },
      {
        id: 'dateSubmitted',
        header: () => t('invoices.columns.dateSubmitted'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.receivedAt ? formatDate(row.original.receivedAt) : t('invoices.fallback')}
          </span>
        ),
      },
      {
        id: 'status',
        header: () => t('invoices.columns.status'),
        cell: ({ row }) => {
          const statusDisplay = resolvePortalInvoiceStatusDisplay(row.original);
          const statusLabel = t(`invoices.status.${statusDisplay.labelKey}`);
          return (
            <AtelierStatusPill variant={statusDisplay.variant}>{statusLabel}</AtelierStatusPill>
          );
        },
      },
    ],
    [t, formatDate],
  );

  const handleRowClick = useCallback(
    (row: InvoiceRow) => handleNavigate(`/portal/invoices/${row.id}`),
    [handleNavigate],
  );

  const handleSubmitInvoice = useCallback(
    () => handleNavigate('/portal/invoices/submit'),
    [handleNavigate],
  );

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

          <div className="hidden min-h-0 flex-1 flex-col md:flex">
            <WorkbenchDataTable
              sectionClassName=""
              columns={columns}
              data={rows}
              totalRows={rows.length}
              clientPagination
              pageIndex={0}
              pageSize={rows.length || 1}
              onPageChange={noop}
              onPageSizeChange={noop}
              isLoading={isLoading}
              entityLabel={t('invoices.title')}
              hideChrome
              hideFooter
              hideDensityToggle
              constrainHeight={false}
              skeletonRows={5}
              emptyIllustration={InvoicesIllustration}
              emptyTitle={t('invoices.emptyTitle')}
              emptyDescription={t('invoices.emptyBody')}
              emptyCta={t('invoices.submitInvoice')}
              onEmptyCta={handleSubmitInvoice}
              emptyCtaIcon={Plus}
              noResultsTitle={t('invoices.emptyTitle')}
              noResultsDescription={t('invoices.emptyBody')}
              onRowClick={handleRowClick}
              getRowId={getInvoiceRowId}
            />
          </div>

          {!isLoading && rows.length > 0 ? (
            <div className="space-y-3 md:hidden">
              {rows.map(invoice => {
                const statusDisplay = resolvePortalInvoiceStatusDisplay(invoice);
                const statusLabel = t(`invoices.status.${statusDisplay.labelKey}`);
                return (
                  <Link key={invoice.id} href={`/portal/invoices/${invoice.id}`} className="block">
                    <Card className="transition-colors hover:bg-muted/50">
                      <CardContent className="space-y-2 pt-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{invoice.invoiceNumber}</span>
                          <span className="text-sm font-medium">
                            {formatMoneyAmount(invoice.totalMinor, invoice.currency, 'en-US')}
                          </span>
                        </div>
                        <p className="text-[13px] text-muted-foreground">
                          {invoice.contract?.title ?? t('invoices.fallback')}
                        </p>
                        <div className="flex items-center justify-between">
                          <AtelierStatusPill variant={statusDisplay.variant}>
                            {statusLabel}
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
          ) : null}
        </section>
      </AnimateIn>
    </div>
  );
}

export default function PortalInvoicesPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalInvoicesPageContent />
    </Suspense>
  );
}
