import { AtelierEmptyState, ContractorsIllustration, DataTable } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import type { ColumnDef } from '@tanstack/react-table';
import { format, formatDistanceStrict } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { Link } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { renderEmptyStateAction } from '../../shared/atelier-bridges.js';

const getAssignmentRowId = (row: Assignment) => row.id;

interface Assignment {
  id: string;
  contractorId: string;
  contractor: {
    id: string;
    legalName: string;
    displayName: string | null;
  };
  assignedByUserId: string;
  assignedAt: string | Date;
  unassignedAt: string | Date | null;
  unassignedByUserId: string | null;
  notes: string | null;
}

interface TabAssignmentsProps {
  assignments: Assignment[];
  currentAssignmentId: string | null;
}

export function TabAssignments({ assignments, currentAssignmentId }: TabAssignmentsProps) {
  const t = useTranslations('Equipment');
  const tContractors = useTranslations('Contractors');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const getRowClassName = useCallback(
    (row: Assignment) => (row.id === currentAssignmentId ? 'bg-primary/5' : ''),
    [currentAssignmentId],
  );

  const columns = useMemo<ColumnDef<Assignment, unknown>[]>(
    () => [
      {
        id: 'contractor',
        accessorFn: row => row.contractor.displayName ?? row.contractor.legalName,
        header: t('detail.colContractor'),
        cell: ({ row }) => {
          const isCurrent = row.original.id === currentAssignmentId;
          return (
            <>
              <Link
                href={`/contractors/${row.original.contractor.id}`}
                className="font-medium hover:underline">
                {row.original.contractor.displayName ?? row.original.contractor.legalName}
              </Link>
              {isCurrent && (
                <Badge variant="success" className="ms-2">
                  {t('detail.badgeCurrent')}
                </Badge>
              )}
            </>
          );
        },
      },
      {
        id: 'assigned',
        accessorFn: row => new Date(row.assignedAt).getTime(),
        header: t('detail.colAssigned'),
        cell: ({ row }) => (
          <span className="text-sm">
            {format(new Date(row.original.assignedAt), 'MMM d, yyyy')}
          </span>
        ),
      },
      {
        id: 'unassigned',
        accessorFn: row => (row.unassignedAt ? new Date(row.unassignedAt).getTime() : 0),
        header: t('detail.colUnassigned'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.unassignedAt
              ? format(new Date(row.original.unassignedAt), 'MMM d, yyyy')
              : '\u2014'}
          </span>
        ),
      },
      {
        id: 'duration',
        header: t('detail.colDuration'),
        enableSorting: false,
        cell: ({ row }) => {
          const duration = row.original.unassignedAt
            ? formatDistanceStrict(
                new Date(row.original.assignedAt),
                new Date(row.original.unassignedAt),
              )
            : `${formatDistanceStrict(new Date(row.original.assignedAt), new Date())}${t('detail.activeSuffix')}`;
          return <span className="text-sm text-muted-foreground">{duration}</span>;
        },
      },
      {
        id: 'notes',
        accessorKey: 'notes',
        header: t('detail.colNotes'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[200px] text-sm text-muted-foreground">
            {row.original.notes ? (
              <span className="line-clamp-2">{row.original.notes}</span>
            ) : (
              '\u2014'
            )}
          </span>
        ),
      },
    ],
    [t, currentAssignmentId],
  );

  if (assignments.length === 0) {
    return (
      <AtelierEmptyState
        variant="subview"
        illustration={ContractorsIllustration}
        heading={t('detail.assignmentsEmpty')}
        body={t('detail.assignmentsEmptyDescription')}
        renderAction={renderEmptyStateAction}
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={assignments}
      totalRows={assignments.length}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={handlePageSizeChange}
      constrainHeight={false}
      hideDensityToggle
      getRowId={getAssignmentRowId}
      rowClassName={getRowClassName}
      entityLabel={tContractors('entityLabel', { count: assignments.length })}
      emptyTitle={t('detail.assignmentsEmpty')}
      emptyDescription={t('detail.assignmentsEmptyDescription')}
      noResultsTitle={t('detail.assignmentsEmpty')}
    />
  );
}
