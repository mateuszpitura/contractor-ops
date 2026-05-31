import { DataTable } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import type { ColumnDef } from '@tanstack/react-table';
import { memo, useCallback, useMemo, useState } from 'react';

import type { TranslateFn } from '../../../i18n/useTranslations.js';
import { formatMinorUnits } from '../../../lib/format-currency.js';
import type { BankStatementMatchResult } from '../hooks/use-bank-statement-import.js';

interface MatchCheckboxProps {
  index: number;
  checked: boolean;
  onToggle: (index: number) => void;
}

const MatchCheckbox = memo(function MatchCheckbox({
  index,
  checked,
  onToggle,
}: MatchCheckboxProps) {
  const handleChange = useCallback(() => onToggle(index), [index, onToggle]);
  return <Checkbox checked={checked} onCheckedChange={handleChange} />;
});

interface BankStatementMatchesDataTableProps {
  t: TranslateFn;
  matches: BankStatementMatchResult[];
  selectedMatches: Set<number>;
  onToggleMatch: (index: number) => void;
}

export function BankStatementMatchesDataTable({
  t,
  matches,
  selectedMatches,
  onToggleMatch,
}: BankStatementMatchesDataTableProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<BankStatementMatchResult, unknown>[]>(
    () => [
      {
        id: 'select',
        header: '',
        enableSorting: false,
        size: 40,
        cell: ({ row }) =>
          row.original.matched ? (
            <MatchCheckbox
              index={row.original.transactionIndex}
              checked={selectedMatches.has(row.original.transactionIndex)}
              onToggle={onToggleMatch}
            />
          ) : null,
      },
      {
        id: 'amount',
        header: () => <span className="text-xs">{t('bankStatement.colAmount')}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {formatMinorUnits(row.original.amountMinor, null, 'pl-PL')}
          </span>
        ),
      },
      {
        id: 'iban',
        header: () => <span className="text-xs">{t('bankStatement.colIban')}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">****{row.original.iban.slice(-4)}</span>
        ),
      },
      {
        id: 'status',
        header: () => <span className="text-xs">{t('bankStatement.colStatus')}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.matched
                ? 'bg-green-500/10 text-green-800 dark:text-green-400'
                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
            }>
            {row.original.matched ? t('bankStatement.matched') : t('bankStatement.unmatched')}
          </Badge>
        ),
      },
      {
        id: 'invoice',
        header: () => <span className="text-xs">{t('bankStatement.colInvoice')}</span>,
        enableSorting: false,
        cell: ({ row }) => <span className="text-xs">{row.original.invoiceNumber ?? '—'}</span>,
      },
    ],
    [t, selectedMatches, onToggleMatch],
  );

  const rowClassName = useMemo(
    () => (row: BankStatementMatchResult) => (row.matched ? '' : 'bg-yellow-500/10'),
    [],
  );

  const getRowId = useCallback((row: BankStatementMatchResult) => String(row.transactionIndex), []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0);
  }, []);

  return (
    <DataTable
      columns={columns}
      data={matches}
      totalRows={matches.length}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={handlePageSizeChange}
      getRowId={getRowId}
      rowClassName={rowClassName}
      constrainHeight={false}
      hideDensityToggle
      entityLabel={t('bankStatement.colStatus')}
      emptyTitle={t('bankStatement.colStatus')}
      noResultsTitle={t('bankStatement.colStatus')}
    />
  );
}
