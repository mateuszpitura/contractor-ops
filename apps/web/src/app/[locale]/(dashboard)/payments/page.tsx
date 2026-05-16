'use client';

import {
  AtelierEmptyState,
  AtelierPageHeader,
  PaymentsIllustration,
  SectionLabel,
} from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FileText, Plus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { BankStatementDialog } from '@/components/payments/bank-statement-dialog';
import { NewPaymentRunDialog } from '@/components/payments/new-payment-run-dialog';
import { PaymentRunSidePanel } from '@/components/payments/payment-run-side-panel';
import type { PaymentRunRow } from '@/components/payments/payment-run-table/columns';
import { getColumns } from '@/components/payments/payment-run-table/columns';
import { PaymentRunDataTable } from '@/components/payments/payment-run-table/data-table';
import { DataTableToolbar } from '@/components/payments/payment-run-table/data-table-toolbar';
import { AnimateIn } from '@/components/shared/animate-in';
import { renderEmptyStateAction } from '@/components/shared/atelier-bridges';
import { PageTableSkeleton } from '@/components/shared/page-table-skeleton';
import { Button } from '@/components/ui/button';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Inner content (uses nuqs, needs Suspense boundary)
// ---------------------------------------------------------------------------

function PaymentsContent() {
  const t = useTranslations('Payments');
  const te = useTranslations('EmptyStates');
  const { formatDate, formatDateTime } = useDateFormatter();

  // URL state via nuqs
  const [statuses, setStatuses] = useQueryState(
    'status',
    parseAsArrayOf(parseAsString).withDefault([]),
  );

  // Date range state (local, not URL-synced for simplicity)
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Cursor-based pagination
  const [cursors, setCursors] = useState<string[]>([]);
  const currentCursor = cursors[cursors.length - 1] ?? undefined;

  // Side panel state
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankStatementRunId, setBankStatementRunId] = useState<string | null>(null);

  // Map multi-select to single API value (API accepts one status enum).
  // When 0 or 2+ selected, send undefined (all) and filter client-side.
  const apiStatus:
    | 'DRAFT'
    | 'LOCKED'
    | 'EXPORTED'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED'
    | undefined =
    statuses.length === 1
      ? (statuses[0] as 'DRAFT' | 'LOCKED' | 'EXPORTED' | 'COMPLETED' | 'FAILED' | 'CANCELLED')
      : undefined;

  // Build query input
  const queryInput = useMemo(
    () => ({
      status: apiStatus,
      cursor: currentCursor,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
    }),
    [apiStatus, currentCursor, dateFrom, dateTo],
  );

  // Fetch payment runs
  const runsQuery = useQuery(trpc.payment.list.queryOptions(queryInput));

  const data = useMemo(() => {
    const result = runsQuery.data;
    // tRPC returns Date objects but PaymentRunRow expects string dates
    const items = (result?.items ?? []) as unknown as PaymentRunRow[];
    // Client-side filter when 2+ statuses selected (API only accepts single value)
    if (statuses.length <= 1) return items;
    const filterSet = new Set(statuses);
    return items.filter(row => filterSet.has(row.status));
  }, [runsQuery.data, statuses]);

  const nextCursor = useMemo(() => {
    const result = runsQuery.data;
    return result?.nextCursor as string | undefined;
  }, [runsQuery.data]);

  // Fetch all payment run dates for calendar dot indicators (independent of pagination).
  // Endpoint returns 'YYYY-MM-DD' strings — parse as local-midnight dates so they match
  // the Calendar's day cells (which use local timezone).
  const activityDatesQuery = useQuery(trpc.payment.activityDates.queryOptions());
  const activityDates = useMemo(() => {
    const raw = activityDatesQuery.data as string[] | undefined;
    if (!raw?.length) return [];
    return raw.map(iso => {
      const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
      return new Date(y, m - 1, d);
    });
  }, [activityDatesQuery.data]);

  // Status change resets pagination (multi-select)
  const handleStatusChange = useCallback(
    (newStatuses: string[]) => {
      void setStatuses(newStatuses);
      setCursors([]);
    },
    [setStatuses],
  );

  const handleDateFromChange = useCallback((date: Date | undefined) => {
    setDateFrom(date);
    setCursors([]);
  }, []);

  const handleDateToChange = useCallback((date: Date | undefined) => {
    setDateTo(date);
    setCursors([]);
  }, []);

  // Pagination handlers
  const handleNextPage = useCallback(() => {
    if (nextCursor) {
      setCursors(prev => [...prev, nextCursor]);
    }
  }, [nextCursor]);

  const handlePreviousPage = useCallback(() => {
    setCursors(prev => prev.slice(0, -1));
  }, []);

  // Row click
  const handleRowClick = useCallback((run: PaymentRunRow) => {
    setSelectedRunId(run.id);
    setSidePanelOpen(true);
  }, []);

  // Column definitions
  const columns = useMemo(
    () =>
      getColumns(
        t,
        {
          onDownloadExport: () => {
            // Download handled via side panel
          },
          onMarkAllPaid: run => {
            setSelectedRunId(run.id);
            setSidePanelOpen(true);
          },
          onCancelRun: run => {
            setSelectedRunId(run.id);
            setSidePanelOpen(true);
          },
        },
        formatDate,
        formatDateTime,
      ),
    [t, formatDate, formatDateTime],
  );

  // Contractor count for smart sequencing
  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );
  const contractorCount = (contractorCountQuery.data as { total: number } | undefined)?.total ?? 0;

  const isLoading = runsQuery.isLoading;
  const isEmpty =
    !isLoading &&
    data.length === 0 &&
    status === 'all' &&
    !dateFrom &&
    !dateTo &&
    cursors.length === 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <AnimateIn delay={0}>
        <AtelierPageHeader
          title={t('title')}
          description={t('pageDescription')}
          actions={
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t('newPaymentRun')}
            </Button>
          }
        />
      </AnimateIn>

      {isEmpty ? (
        /* Empty state with smart sequencing */
        <AnimateIn delay={1}>
          <AtelierEmptyState
            illustration={PaymentsIllustration}
            heading={te('payments.heading')}
            body={te('payments.body')}
            primaryAction={{ label: te('payments.cta'), href: '/invoices', icon: FileText }}
            prerequisiteMissing={contractorCount === 0}
            prerequisiteAction={{
              label: te('prerequisite.cta'),
              href: '/contractors',
              icon: Users,
            }}
            renderAction={renderEmptyStateAction}
          />
        </AnimateIn>
      ) : (
        <AnimateIn delay={1}>
          <section aria-label={t('title')} className="space-y-3">
            <SectionLabel icon={CreditCard}>{t('title')}</SectionLabel>

            {/* Toolbar */}
            <DataTableToolbar
              activeStatuses={statuses}
              onStatusChange={handleStatusChange}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={handleDateFromChange}
              onDateToChange={handleDateToChange}
              activityDates={activityDates}
              isLoading={isLoading}
            />

            {/* Table */}
            <PaymentRunDataTable
              data={data}
              columns={columns}
              isLoading={isLoading}
              hasNextPage={!!nextCursor}
              hasPreviousPage={cursors.length > 0}
              onNextPage={handleNextPage}
              onPreviousPage={handlePreviousPage}
              onRowClick={handleRowClick}
            />
          </section>
        </AnimateIn>
      )}

      {/* Side panel */}
      <PaymentRunSidePanel
        runId={selectedRunId}
        open={sidePanelOpen}
        // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
        onOpenChange={open => {
          setSidePanelOpen(open);
          if (!open) setSelectedRunId(null);
        }}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onImportStatement={runId => setBankStatementRunId(runId)}
      />

      {/* New payment run dialog */}
      <NewPaymentRunDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
        onViewRun={() => {
          // After dialog creates a run, refresh the list
        }}
      />

      {/* Bank statement import dialog */}
      {!!bankStatementRunId && (
        <BankStatementDialog
          runId={bankStatementRunId}
          open={!!bankStatementRunId}
          // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler
          onOpenChange={open => {
            if (!open) setBankStatementRunId(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

/**
 * Payments page at /payments.
 * Wrapped in Suspense to handle nuqs useSearchParams usage.
 */
export default function PaymentsPage() {
  return (
    <Suspense fallback={<PageTableSkeleton />}>
      <PaymentsContent />
    </Suspense>
  );
}
