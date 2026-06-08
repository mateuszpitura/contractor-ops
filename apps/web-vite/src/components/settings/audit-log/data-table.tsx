import { AuditLogIllustration, DataTable } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import type { ColumnDef } from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { useCallback, useMemo } from 'react';

import { Link } from '../../../i18n/navigation';
import { tDynLoose } from '../../../i18n/typed-keys';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { enumKey } from '../../../lib/enum-key';
import { AuditLogDiffViewer } from '../audit-log-diff-viewer';

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

interface ExpandRowButtonProps {
  rowId: string;
  isExpanded: boolean;
  expandLabel: string;
  collapseLabel: string;
  onToggle: (id: string) => void;
}

function ExpandRowButton({
  rowId,
  isExpanded,
  expandLabel,
  collapseLabel,
  onToggle,
}: ExpandRowButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(rowId);
    },
    [onToggle, rowId],
  );
  return (
    <button
      type="button"
      className="flex items-center justify-center rounded p-1 hover:bg-muted"
      onClick={handleClick}
      aria-label={isExpanded ? collapseLabel : expandLabel}>
      <ChevronRight className={`size-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
    </button>
  );
}

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
  onPageSizeChange?: (size: number) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  expandedRows: Record<string, boolean>;
  onToggleRow: (id: string) => void;
  isLoading?: boolean;
  isFetching?: boolean;
}

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

/**
 * Audit log table — server-side pagination + sort (createdAt only).
 * Rows expand to render a diff viewer via the canonical primitive's
 * `renderSubRow` slot.
 */
export function AuditLogTable({
  data,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortOrder,
  onSortOrderChange,
  expandedRows,
  onToggleRow,
  isLoading,
  isFetching,
}: AuditLogTableProps) {
  const t = useTranslations('Settings.auditLog');

  const toggleSortOrder = useCallback(
    () => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc'),
    [onSortOrderChange, sortOrder],
  );

  const columns: ColumnDef<AuditLogEntry>[] = useMemo(
    () => [
      {
        id: 'timestamp',
        header: () => (
          <button
            type="button"
            className="flex items-center gap-1 uppercase hover:text-foreground"
            onClick={toggleSortOrder}>
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
                  onClick={stopPropagation}>
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
        enableSorting: false,
        cell: ({ row }) => {
          const isExpanded = !!expandedRows[row.original.id];
          return (
            <ExpandRowButton
              rowId={row.original.id}
              isExpanded={isExpanded}
              expandLabel={t('expand')}
              collapseLabel={t('collapse')}
              onToggle={onToggleRow}
            />
          );
        },
      },
    ],
    [t, expandedRows, onToggleRow, sortOrder, toggleSortOrder],
  );

  const handlePageChange = useCallback((next: number) => onPageChange(next + 1), [onPageChange]);
  const handleRowClick = useCallback((row: AuditLogEntry) => onToggleRow(row.id), [onToggleRow]);
  const renderSubRow = useCallback(
    (row: AuditLogEntry) => (
      <AuditLogDiffViewer
        oldValues={row.oldValuesJson as Record<string, unknown> | null}
        newValues={row.newValuesJson as Record<string, unknown> | null}
      />
    ),
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      totalRows={totalCount}
      pageIndex={Math.max(0, page - 1)}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      onPageSizeChange={
        onPageSizeChange ??
        (() => {
          /* intentionally empty: page size is fixed when no handler is provided */
        })
      }
      isLoading={isLoading}
      isRefetching={isFetching && !isLoading}
      fill
      getRowId={row => row.id}
      onRowClick={handleRowClick}
      renderSubRow={renderSubRow}
      expandedRowIds={expandedRows}
      entityLabel={t('entityLabel', { count: totalCount })}
      emptyIcon={<AuditLogIllustration className="h-20 w-20 text-primary/70" aria-hidden="true" />}
      emptyTitle={t('empty.heading')}
      emptyDescription={t('empty.body')}
      noResultsTitle={t('empty.heading')}
      noResultsDescription={t('empty.body')}
    />
  );
}
