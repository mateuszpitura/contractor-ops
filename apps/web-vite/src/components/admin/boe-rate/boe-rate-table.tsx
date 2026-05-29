import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import type { ColumnDef } from '@tanstack/react-table';
import { PencilIcon, TrashIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { SimpleDataTable } from '../../shared/simple-data-table.js';
import type { BoeRateEntry } from '../hooks/use-admin-boe-rate.js';

interface BoeRateRowActionsProps {
  entry: BoeRateEntry;
  onEdit: (entry: BoeRateEntry) => void;
  onDelete: (entry: BoeRateEntry) => void;
  ariaEdit: string;
  ariaDelete: string;
}

function BoeRateRowActions({
  entry,
  onEdit,
  onDelete,
  ariaEdit,
  ariaDelete,
}: BoeRateRowActionsProps) {
  const handleEdit = useCallback(() => onEdit(entry), [onEdit, entry]);
  const handleDelete = useCallback(() => onDelete(entry), [onDelete, entry]);
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={handleEdit} aria-label={ariaEdit}>
        <PencilIcon className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleDelete} aria-label={ariaDelete}>
        <TrashIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface BoeRateTableProps {
  entries: BoeRateEntry[] | undefined;
  isLoading: boolean;
  onEdit: (entry: BoeRateEntry) => void;
  onDelete: (entry: BoeRateEntry) => void;
}

export function BoeRateTable({ entries, isLoading, onEdit, onDelete }: BoeRateTableProps) {
  const t = useTranslations('Admin.BoeRate');
  const rows = entries ?? [];

  const columns = useMemo<ColumnDef<BoeRateEntry, unknown>[]>(
    () => [
      {
        id: 'effectiveFrom',
        accessorFn: row => new Date(row.effectiveFrom).getTime(),
        header: t('colEffectiveFrom'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {new Date(row.original.effectiveFrom).toISOString().slice(0, 10)}
          </span>
        ),
      },
      {
        id: 'ratePercent',
        accessorFn: row => Number(row.ratePercent),
        header: () => <span className="block text-end">{t('colRatePercent')}</span>,
        cell: ({ row }) => (
          <div className="text-end tabular-nums font-mono">
            {Number(row.original.ratePercent).toFixed(2)}%
          </div>
        ),
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: t('colSource'),
        cell: ({ row }) => {
          const sourceLabel =
            row.original.source === 'BOE_API' ? t('sourceBoeApi') : t('sourceManual');
          return (
            <Badge
              variant={row.original.source === 'BOE_API' ? 'secondary' : 'outline'}
              aria-label={`Source: ${sourceLabel}`}>
              {sourceLabel}
            </Badge>
          );
        },
      },
      {
        id: 'recordedBy',
        accessorKey: 'recordedByUserId',
        header: t('colRecordedBy'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.recordedByUserId ?? 'System'}
          </span>
        ),
      },
      {
        id: 'recordedAt',
        accessorFn: row => new Date(row.recordedAt).getTime(),
        header: t('colRecordedAt'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.recordedAt).toISOString().slice(0, 10)}
          </span>
        ),
      },
      {
        id: 'notes',
        accessorKey: 'notes',
        header: t('colNotes'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate text-sm text-muted-foreground">
            {row.original.notes ?? '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="block text-end">{t('colActions')}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <BoeRateRowActions
            entry={row.original}
            onEdit={onEdit}
            onDelete={onDelete}
            ariaEdit={t('ariaEditRate')}
            ariaDelete={t('ariaDeleteRate')}
          />
        ),
      },
    ],
    [t, onEdit, onDelete],
  );

  return (
    <SimpleDataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      entityLabel={t('entityLabel', { count: rows.length })}
      emptyTitle={t('noRateEntries')}
      emptyDescription={t('noRateEntriesBody')}
      noResultsTitle={t('noRateEntries')}
      noResultsDescription={t('noRateEntriesBody')}
    />
  );
}
