import { minorToMajor } from '@contractor-ops/shared';
import { TeamsIllustration } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import { SourceBadge } from '../shared/source-badge.js';
import { StatusBadge } from '../shared/status-badge.js';
import type { ProjectRow } from './project-form-sheet.js';

export interface ProjectTableRow extends ProjectRow {
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  source: 'MANUAL' | 'JIRA' | 'LINEAR';
  externalId: string | null;
  updatedAt: Date | string;
}

interface ProjectTableProps {
  rows: ProjectTableRow[];
  teamNamesById: Record<string, string>;
  onRowClick?: (row: ProjectTableRow) => void;
  onNewProject?: () => void;
  onClearSearch?: () => void;
  hasSearch?: boolean;
  isLoading?: boolean;
}

const formatBudget = (minor: number | null, currency: string | null): string => {
  if (minor == null || !currency) return '—';
  return `${minorToMajor(minor, currency).toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  })}`;
};

export function ProjectTable({
  rows,
  teamNamesById,
  onRowClick,
  onNewProject,
  onClearSearch,
  hasSearch = false,
  isLoading,
}: ProjectTableProps) {
  const t = useTranslations('Organization');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<ProjectTableRow, unknown>[]>(
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
        id: 'team',
        accessorFn: row => (row.teamId ? (teamNamesById[row.teamId] ?? row.teamId) : '—'),
        header: t('colTeam'),
        cell: info => <span className="text-muted-foreground">{info.getValue() as string}</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('colStatus'),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'budget',
        accessorFn: row => row.budgetMinor ?? 0,
        header: t('colBudget'),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatBudget(row.original.budgetMinor, row.original.budgetCurrency)}
          </span>
        ),
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
    [t, teamNamesById],
  );

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

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
        entityLabel={t('entityProjects', { count: rows.length })}
        isLoading={isLoading}
        hasFiltersOrSearch={hasSearch}
        onClearFilters={onClearSearch}
        clearFiltersLabel={t('clearSearchChip')}
        onRowClick={onRowClick}
        emptyIllustration={TeamsIllustration}
        emptyTitle={t('projectsEmptyTitle')}
        emptyDescription={t('projectsEmptyBody')}
        emptyCta={onNewProject ? t('projectsEmptyCta') : undefined}
        onEmptyCta={onNewProject}
        emptyCtaIcon={Plus}
        noResultsTitle={t('noResultsTitle')}
        noResultsDescription={t('noResultsBody')}
        noResultsCta={t('noResultsCta')}
      />
    </div>
  );
}
