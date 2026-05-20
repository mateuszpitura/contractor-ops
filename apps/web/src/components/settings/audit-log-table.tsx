'use client';

import { AtelierTableShell, AuditLogIllustration } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import { tDynLoose } from '@/i18n/typed-keys';
import { enumKey } from '@/lib/enum-key';
import { AuditLogDiffViewer } from './audit-log-diff-viewer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  oldValuesJson: Record<string, unknown> | null;
  newValuesJson: Record<string, unknown> | null;
  metadataJson: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogTableProps {
  data: AuditLogEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  expandedRows: Record<string, boolean>;
  onToggleRow: (id: string) => void;
  isLoading?: boolean;
  isFetching?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fallback: split camelCase key into capitalised words. */
function humanizeAction(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
}

const RESOURCE_TYPE_URL_MAP: Record<string, (id: string) => string> = {
  CONTRACTOR: id => `/contractors/${id}`,
  CONTRACT: id => `/contracts/${id}`,
  INVOICE: id => `/invoices/${id}`,
  WORKFLOW_RUN: id => `/workflows/${id}`,
  PAYMENT_RUN: () => `/payments`,
  USER: () => `/settings/members`,
  ORGANIZATION: () => `/settings`,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TanStack Table for audit log entries with expandable rows showing diffs.
 * Server-side pagination and sort (createdAt only).
 */
export function AuditLogTable({
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  sortOrder,
  onSortOrderChange,
  expandedRows,
  onToggleRow,
  isLoading,
  isFetching,
}: AuditLogTableProps) {
  const t = useTranslations('Settings.auditLog');

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const columns: ColumnDef<AuditLogEntry>[] = useMemo(
    () => [
      {
        id: 'timestamp',
        header: () => (
          <button
            type="button"
            className="flex items-center gap-1 uppercase hover:text-foreground"
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}>
            {t('columns.timestamp')}
            {sortOrder === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : sortOrder === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-40" />
            )}
          </button>
        ),
        size: 140,
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          const relative = formatDistanceToNow(date, { addSuffix: true });
          const absolute = format(date, 'yyyy-MM-dd HH:mm:ss');
          return (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-sm text-muted-foreground">{relative}</span>
              </TooltipTrigger>
              <TooltipContent>{absolute}</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: 'actor',
        header: () => t('columns.actor'),
        size: 180,
        cell: ({ row }) => {
          const { actorName, metadataJson } = row.original;
          const role = (metadataJson as Record<string, unknown> | null)?.role as string | undefined;
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{actorName ?? t('unknownActor')}</span>
              {!!role && (
                <Badge variant="secondary" className="text-[11px]">
                  {role}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'action',
        header: () => t('columns.action'),
        cell: ({ row }) => {
          const actionKey = row.original.action;
          const key = enumKey(actionKey);
          const translated = tDynLoose(t, 'actions', key);
          // next-intl returns the full key path when a translation is missing —
          // fall back to a humanised version of the camelCase key instead.
          const label = translated.includes('.') ? humanizeAction(key) : translated;
          return <span className="text-sm font-semibold">{label}</span>;
        },
      },
      {
        id: 'resource',
        header: () => t('columns.resource'),
        cell: ({ row }) => {
          const { resourceType, resourceId, resourceName } = row.original;
          const urlFn = RESOURCE_TYPE_URL_MAP[resourceType];
          const href = urlFn?.(resourceId);
          return (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px]">
                {(() => {
                  const rKey = enumKey(resourceType);
                  const rt = tDynLoose(t, 'resources', rKey);
                  return rt.includes('.') ? humanizeAction(rKey) : rt;
                })()}
              </Badge>
              {href ? (
                <Link
                  href={href}
                  className="text-sm text-primary underline-offset-2 hover:underline"
                  // biome-ignore lint/nursery/noJsxPropsBind: stopPropagation handler
                  onClick={e => e.stopPropagation()}>
                  {resourceName ?? resourceId}
                </Link>
              ) : (
                <span className="text-sm">{resourceName ?? resourceId}</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'details',
        header: () => null,
        size: 40,
        cell: ({ row }) => {
          const isExpanded = !!expandedRows[row.original.id];
          return (
            <button
              type="button"
              className="flex items-center justify-center rounded p-1 hover:bg-muted"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={e => {
                e.stopPropagation();
                onToggleRow(row.original.id);
              }}
              aria-label={isExpanded ? t('collapse') : t('expand')}>
              <ChevronRight
                className={`size-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          );
        },
      },
    ],
    [t, expandedRows, onToggleRow, sortOrder, onSortOrderChange],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId: row => row.id,
  });

  const pagination =
    totalCount > 0 ? (
      <div className="flex items-center justify-between px-1 py-1">
        <p className="text-sm text-muted-foreground">
          {t('pagination.summary', { page, totalPages })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => onPageChange(page - 1)}>
            {t('pagination.previous')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
            onClick={() => onPageChange(page + 1)}>
            {t('pagination.next')}
          </Button>
        </div>
      </div>
    ) : null;

  return (
    <AtelierTableShell isLoading={isFetching && !isLoading} footer={pagination}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  style={
                    header.column.getSize() === 150 ? undefined : { width: header.column.getSize() }
                  }>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <TableRow key={`skeleton-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-full max-w-[120px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ms-auto h-4 w-4 rounded-sm" />
                </TableCell>
              </TableRow>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-16 text-center">
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <div className="text-primary/70">
                    <AuditLogIllustration className="h-20 w-20" />
                  </div>
                  <h3 className="mt-4 text-[16px] font-medium">{t('empty.heading')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t('empty.body')}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => {
              const isExpanded = !!expandedRows[row.original.id];
              return (
                <Fragment key={row.id}>
                  {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
                  <TableRow className="cursor-pointer" onClick={() => onToggleRow(row.original.id)}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="p-0">
                        <AuditLogDiffViewer
                          oldValues={row.original.oldValuesJson as Record<string, unknown> | null}
                          newValues={row.original.newValuesJson as Record<string, unknown> | null}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </AtelierTableShell>
  );
}
