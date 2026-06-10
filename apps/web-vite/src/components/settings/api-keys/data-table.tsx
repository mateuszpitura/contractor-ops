import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@contractor-ops/ui/components/shadcn/dropdown-menu';
import type { ColumnDef } from '@tanstack/react-table';
import { Key, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';

import type { useApiKeysTab } from '../hooks/use-api-keys-tab.js';

type ApiKeysHookReturn = ReturnType<typeof useApiKeysTab>;
type ApiKeyRow = NonNullable<ApiKeysHookReturn['keys']>[number];
type TranslateFn = ApiKeysHookReturn['t'];

export interface EditTarget {
  id: string;
  name: string;
  scopes: readonly string[];
}

export interface RevokeTarget {
  id: string;
  name: string;
}

interface ApiKeysDataTableProps {
  t: TranslateFn;
  keys: readonly ApiKeyRow[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (target: EditTarget) => void;
  onRevoke: (target: RevokeTarget) => void;
}

type KeyStatus = 'active' | 'revoked' | 'expired';

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

function getKeyStatus(key: {
  revokedAt: string | Date | null;
  expiresAt: string | Date | null;
}): KeyStatus {
  if (key.revokedAt) return 'revoked';
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return 'expired';
  return 'active';
}

function statusBadgeVariant(status: KeyStatus) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'revoked':
      return 'destructive' as const;
    case 'expired':
      return 'warning' as const;
  }
}

interface ActionsCellProps {
  row: ApiKeyRow;
  status: KeyStatus;
  t: TranslateFn;
  onEdit: (target: EditTarget) => void;
  onRevoke: (target: RevokeTarget) => void;
}

function ActionsCell({ row, status, t, onEdit, onRevoke }: ActionsCellProps) {
  const handleEdit = useCallback(
    () => onEdit({ id: row.id, name: row.name, scopes: row.scopes }),
    [onEdit, row.id, row.name, row.scopes],
  );
  const handleRevoke = useCallback(
    () => onRevoke({ id: row.id, name: row.name }),
    [onRevoke, row.id, row.name],
  );

  if (status !== 'active') return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={t('aria.keyActions')} />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil className="me-2 size-4" />
          {t('editAction')}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={handleRevoke}>
          <Trash2 className="me-2 size-4" />
          {t('revokeAction')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ApiKeysDataTable({
  t,
  keys,
  isLoading,
  onCreate,
  onEdit,
  onRevoke,
}: ApiKeysDataTableProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const columns = useMemo<ColumnDef<ApiKeyRow, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: t('tableHeaders.name'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'key',
        accessorKey: 'prefix',
        header: t('tableHeaders.key'),
        enableSorting: false,
        cell: ({ row }) => (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            co_live_{row.original.prefix}...
          </code>
        ),
      },
      {
        id: 'scopes',
        header: t('tableHeaders.scopes'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.scopes.map(scope => (
              <Badge key={scope} variant="outline" className="text-[10px]">
                {scope}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'createdBy',
        accessorFn: row => row.createdBy?.name ?? '',
        header: t('tableHeaders.createdBy'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.createdBy?.name ?? '—'}</span>
        ),
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('tableHeaders.created'),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'lastUsedAt',
        accessorKey: 'lastUsedAt',
        header: t('tableHeaders.lastUsed'),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatDate(row.original.lastUsedAt)}
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: row => getKeyStatus(row),
        header: t('tableHeaders.status'),
        cell: ({ row }) => {
          const status = getKeyStatus(row.original);
          return (
            <Badge variant={statusBadgeVariant(status)} className="capitalize">
              {status}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('aria.keyActions')}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <ActionsCell
            row={row.original}
            status={getKeyStatus(row.original)}
            t={t}
            onEdit={onEdit}
            onRevoke={onRevoke}
          />
        ),
      },
    ],
    [t, onEdit, onRevoke],
  );

  const data = useMemo(() => [...keys], [keys]);

  return (
    <WorkbenchDataTable
      columns={columns}
      data={data}
      totalRows={data.length}
      clientPagination
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={size => {
        setPageSize(size);
        setPageIndex(0);
      }}
      isLoading={isLoading}
      hideDensityToggle
      constrainHeight={false}
      entityLabel={t('entityLabel', { count: data.length })}
      emptyIcon={<Key className="size-5 text-muted-foreground" />}
      emptyTitle={t('emptyHeading')}
      emptyDescription={t('emptyBody')}
      emptyCta={t('createKeyButton')}
      onEmptyCta={onCreate}
      emptyCtaIcon={Plus}
      noResultsTitle={t('emptyHeading')}
      noResultsDescription={t('emptyBody')}
    />
  );
}
