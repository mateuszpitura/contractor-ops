import type { ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';

import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';

const PROCESSOR_IDS = [
  'vercel',
  'neon',
  'cloudflare',
  'stripe',
  'resend',
  'sentry',
  'axiom',
  'upstash',
  'cronitor',
  'uptimerobot',
  'qstash',
] as const;

type ProcessorRow = {
  id: (typeof PROCESSOR_IDS)[number];
  processor: string;
  purpose: string;
  dataProcessed: string;
  location: string;
};

interface SubProcessorsTableProps {
  t: (key: string) => string;
}

const getProcessorRowId = (row: ProcessorRow) => row.id;

export function SubProcessorsTable({ t }: SubProcessorsTableProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  const rows = useMemo<ProcessorRow[]>(
    () =>
      PROCESSOR_IDS.map(id => ({
        id,
        processor: t(`processors.${id}.name`),
        purpose: t(`processors.${id}.purpose`),
        dataProcessed: t(`processors.${id}.data`),
        location: t(`processors.${id}.location`),
      })),
    [t],
  );

  const columns = useMemo<ColumnDef<ProcessorRow, unknown>[]>(
    () => [
      {
        id: 'processor',
        accessorKey: 'processor',
        header: t('table.processor'),
        cell: ({ row }) => <span className="font-medium">{row.original.processor}</span>,
        enableSorting: false,
      },
      {
        id: 'purpose',
        accessorKey: 'purpose',
        header: t('table.purpose'),
        enableSorting: false,
      },
      {
        id: 'dataProcessed',
        accessorKey: 'dataProcessed',
        header: t('table.dataProcessed'),
        enableSorting: false,
      },
      {
        id: 'location',
        accessorKey: 'location',
        header: t('table.location'),
        enableSorting: false,
      },
    ],
    [t],
  );

  return (
    <WorkbenchDataTable
      columns={columns}
      data={rows}
      totalRows={rows.length}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={handlePageSizeChange}
      hideDensityToggle
      constrainHeight={false}
      entityLabel={t('table.processor')}
      emptyTitle={t('table.processor')}
      noResultsTitle={t('table.processor')}
      getRowId={getProcessorRowId}
    />
  );
}
