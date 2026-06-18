import { TeamsIllustration } from '@contractor-ops/ui';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Plus, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import { SourceBadge } from '../shared/source-badge.js';
import { StatusBadge } from '../shared/status-badge.js';
import type { TeamRow } from './team-form-sheet.js';

export interface TeamTableRow extends TeamRow {
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  source: 'MANUAL' | 'JIRA' | 'LINEAR';
  externalId: string | null;
  updatedAt: Date | string;
}

interface TeamTableProps {
  rows: TeamTableRow[];
  onRowClick?: (row: TeamTableRow) => void;
  onNewTeam?: () => void;
  onClearSearch?: () => void;
  hasSearch?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function TeamTable({
  rows,
  onRowClick,
  onNewTeam,
  onClearSearch,
  hasSearch = false,
  isLoading,
  isError,
  onRetry,
}: TeamTableProps) {
  const t = useTranslations('Organization');
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const columns = useMemo<ColumnDef<TeamTableRow, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: t('colName'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'code',
        accessorKey: 'code',
        header: t('colCode'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.code ?? '—'}</span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('colStatus'),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: t('colSource'),
        cell: ({ row }) => <SourceBadge source={row.original.source} />,
      },
      {
        id: 'updated',
        accessorFn: row => new Date(row.updatedAt).getTime(),
        header: t('colUpdated'),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {format(new Date(row.original.updatedAt), 'yyyy-MM-dd')}
          </span>
        ),
      },
    ],
    [t],
  );

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/50 bg-card py-12">
        <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {tProfile('error.retry')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkbenchDataTable
        columns={columns}
        data={rows}
        totalRows={rows.length}
        clientPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={handlePageSizeChange}
        entityLabel={t('entityTeams', { count: rows.length })}
        isLoading={isLoading}
        hasFiltersOrSearch={hasSearch}
        onClearFilters={onClearSearch}
        clearFiltersLabel={t('clearSearchChip')}
        onRowClick={onRowClick}
        emptyIllustration={TeamsIllustration}
        emptyTitle={t('teamsEmptyTitle')}
        emptyDescription={t('teamsEmptyBody')}
        emptyCta={onNewTeam ? t('teamsEmptyCta') : undefined}
        onEmptyCta={onNewTeam}
        emptyCtaIcon={Plus}
        noResultsTitle={t('noResultsTitle')}
        noResultsDescription={t('noResultsBody')}
        noResultsCta={t('noResultsCta')}
      />
    </div>
  );
}
