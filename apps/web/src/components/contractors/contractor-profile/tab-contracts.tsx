'use client';

import { AtelierEmptyState, ContractsIllustration, SectionLabel } from '@contractor-ops/ui';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { FileText, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { ContractWizardDialog } from '@/components/contracts/contract-wizard/wizard-dialog';
import { DataTableBody } from '@/components/shared/data-table-body';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from '@/i18n/navigation';
import { enumKey } from '@/lib/enum-key';
import { useDateFormatter } from '@/lib/format/use-date-formatter';
import { trpc } from '@/trpc/init';
import { tDyn } from '@/i18n/typed-keys';

// ---------------------------------------------------------------------------
// Row type (subset of full ContractRow for the mini table)
// ---------------------------------------------------------------------------

type MiniContractRow = {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  rateValueMinor: number | null;
  currency: string;
};

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

const statusBadgeColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground border border-border',
  PENDING_SIGNATURE: 'bg-muted text-muted-foreground border border-border',
  ACTIVE: 'bg-green-500/10 text-green-600 dark:text-green-400',
  EXPIRING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  EXPIRED: 'bg-red-500/10 text-red-600 dark:text-red-400',
  TERMINATED: 'bg-muted text-muted-foreground border border-border',
  SUPERSEDED: 'bg-muted/50 text-muted-foreground/60 border border-border/50',
  ARCHIVED: 'bg-muted text-muted-foreground border border-border',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TabContractsProps = {
  contractorId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TabContracts({ contractorId }: TabContractsProps) {
  const t = useTranslations('Contracts');
  const { formatDate } = useDateFormatter();
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const contractsQuery = useQuery(
    trpc.contract.list.queryOptions({
      contractorId,
      page,
      pageSize,
      sortBy: 'startDate',
      sortOrder: 'desc',
    }),
  );

  const queryData = contractsQuery.data;
  // Memoize against the stable React Query data reference rather than
  // creating a new `[]` fallback every render while loading.
  const items: MiniContractRow[] = useMemo(
    () => (queryData?.items ?? []) as unknown as MiniContractRow[],
    [queryData],
  );
  const totalCount: number = queryData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const columns: ColumnDef<MiniContractRow>[] = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: t('contractorTab.columns.title'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        accessorKey: 'status',
        header: t('contractorTab.columns.status'),
        cell: ({ row }) => (
          <Badge variant="secondary" className={statusBadgeColors[row.original.status] ?? ''}>
            {tDyn(t, 'status', enumKey(row.original.status))}
          </Badge>
        ),
      },
      {
        accessorKey: 'startDate',
        header: t('contractorTab.columns.startDate'),
        cell: ({ row }) => {
          if (!row.original.startDate)
            return <span className="text-muted-foreground">&mdash;</span>;
          try {
            return <span className="text-sm">{formatDate(row.original.startDate)}</span>;
          } catch {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
        },
      },
      {
        accessorKey: 'endDate',
        header: t('contractorTab.columns.endDate'),
        cell: ({ row }) => {
          if (!row.original.endDate) return <span className="text-muted-foreground">&mdash;</span>;
          try {
            return <span className="text-sm">{formatDate(row.original.endDate)}</span>;
          } catch {
            return <span className="text-muted-foreground">&mdash;</span>;
          }
        },
      },
      {
        accessorKey: 'rateValueMinor',
        header: t('contractorTab.columns.rate'),
        cell: ({ row }) => {
          const minor = row.original.rateValueMinor;
          if (typeof minor !== 'number')
            return <span className="text-muted-foreground">&mdash;</span>;
          const formatted = new Intl.NumberFormat('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(minor / 100);
          return (
            <span className="font-mono text-sm tabular-nums">
              {formatted} {row.original.currency}
            </span>
          );
        },
      },
    ],
    [t, formatDate],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  const isLoading = contractsQuery.isLoading;

  // Empty state only when fully loaded and truly empty
  if (!isLoading && items.length === 0) {
    return (
      <>
        <AtelierEmptyState
          variant="subview"
          illustration={ContractsIllustration}
          heading={t('contractorTab.emptyHeading')}
          body={t('contractorTab.emptyBody')}
          primaryAction={{
            label: t('contractorTab.emptyCTA'),
            onClick: () => setWizardOpen(true),
            icon: Plus,
          }}
          renderAction={(action, variant) => {
            const Icon = action.icon;
            return (
              <Button
                variant={variant === 'secondary' ? 'outline' : 'default'}
                onClick={action.onClick}>
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {action.label}
              </Button>
            );
          }}
        />
        <ContractWizardDialog
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          contractorId={contractorId}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with CTA */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SectionLabel icon={FileText}>{t('contractorTab.heading')}</SectionLabel>
        </div>
        <Button
          size="sm"
          disabled={isLoading}
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => setWizardOpen(true)}>
          <Plus className="me-1.5 size-3.5" />
          {t('contractorTab.addCTA')}
        </Button>
      </div>

      {/* Mini table */}
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <DataTableBody
            table={table}
            isLoading={isLoading}
            hasFiltersOrSearch={false}
            emptyTitle={t('contractorTab.emptyHeading')}
            emptyDescription={t('contractorTab.emptyBody')}
            noResultsTitle={t('contractorTab.emptyHeading')}
            skeletonRows={5}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onRowClick={row => router.push(`/contracts/${row.id}`)}
          />
        </Table>
      </div>

      {/* Simple pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || page <= 1}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setPage(p => Math.max(1, p - 1))}>
            &laquo;
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || page >= totalPages}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            &raquo;
          </Button>
        </div>
      )}

      {/* Wizard dialog */}
      <ContractWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        contractorId={contractorId}
      />
    </div>
  );
}
