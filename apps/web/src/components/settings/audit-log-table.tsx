'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from '@/i18n/navigation';
import { AuditLogDiffViewer } from './audit-log-diff-viewer';
import { enumKey } from '@/lib/enum-key';

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
          return (
            <span className="text-sm font-semibold">
              {t(`actions.${enumKey(actionKey)}` as Parameters<typeof t>[0])}
            </span>
          );
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
                {t(`resources.${enumKey(resourceType)}` as Parameters<typeof t>[0])}
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

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: 140 }}>{t('columns.timestamp')}</TableHead>
              <TableHead style={{ width: 180 }}>{t('columns.actor')}</TableHead>
              <TableHead>{t('columns.action')}</TableHead>
              <TableHead>{t('columns.resource')}</TableHead>
              <TableHead style={{ width: 40 }} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <TableRow key={`skeleton-${i}`}>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-4" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border bg-background">
      {/* Refetch overlay */}
      {isFetching && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
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
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-16 text-center">
                <h3 className="text-[16px] font-medium">{t('empty.heading')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('empty.body')}</p>
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => {
              const isExpanded = !!expandedRows[row.original.id];
              return (
                <span key={row.id} className="contents">
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
                </span>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
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
      )}
    </div>
  );
}
