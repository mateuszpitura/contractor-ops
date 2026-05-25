import type { WorkflowRunStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Checkbox } from '@contractor-ops/ui/components/shadcn/checkbox';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle } from 'lucide-react';

import type { LooseTranslator } from '../../../i18n/typed-keys.js';
import { tDynLoose } from '../../../i18n/typed-keys.js';
import { enumKey } from '../../../lib/enum-key.js';

// ---------------------------------------------------------------------------
// Row type matching the tRPC workflow.listRuns response shape
// ---------------------------------------------------------------------------

export type WorkflowRunRow = {
  id: string;
  status: string;
  dueAt: string | null;
  startedAt: string | null;
  createdAt: string;
  workflowTemplate: {
    name: string;
    type: string;
  };
  contractor: {
    id: string;
    legalName: string;
    displayName: string | null;
  };
  progress: {
    done: number;
    total: number;
    percent: number;
  };
  tasks: Array<{ status: string; resultJson?: unknown }>;
};

// ---------------------------------------------------------------------------
// Template type badge styling
// ---------------------------------------------------------------------------

const templateTypeBadgeColors: Record<string, string> = {
  ONBOARDING: 'bg-primary/10 text-primary',
  OFFBOARDING: 'bg-amber-500/10 text-amber-800 dark:text-amber-400',
  DOCUMENT_COLLECTION: 'bg-muted text-muted-foreground',
  COMPLIANCE_REVIEW: 'bg-muted text-muted-foreground',
  CUSTOM: 'bg-muted text-muted-foreground',
};

type DateFormatter = (value: Date | string | null | undefined) => string;

/**
 * Returns all column definitions for the workflow runs data table.
 */
export function getColumns(
  t: LooseTranslator,
  formatDate?: DateFormatter,
): ColumnDef<WorkflowRunRow>[] {
  const fmtDate: DateFormatter =
    formatDate ??
    (v => {
      if (!v) return '\u2014';
      try {
        return new Date(typeof v === 'string' ? v : v).toLocaleDateString();
      } catch {
        return '\u2014';
      }
    });

  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('columns.selectAll')}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label={t('columns.selectRow')}
          // biome-ignore lint/nursery/noJsxPropsBind: column definition
          onClick={e => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: 'workflowName',
      accessorFn: row => row.workflowTemplate.name,
      header: t('columns.workflowName'),
      cell: ({ row }) => (
        <div className="min-w-[160px]">
          <span className="font-medium">{row.original.workflowTemplate.name}</span>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: 'contractor',
      accessorFn: row => row.contractor.displayName ?? row.contractor.legalName,
      header: t('columns.contractor'),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.contractor.displayName ?? row.original.contractor.legalName}
        </span>
      ),
    },
    {
      id: 'templateType',
      accessorFn: row => row.workflowTemplate.type,
      header: t('columns.templateType'),
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={templateTypeBadgeColors[row.original.workflowTemplate.type] ?? ''}>
          {tDynLoose(t, 'templateType', enumKey(row.original.workflowTemplate.type))}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <AtelierStatusPill
            variant={statusToVariant('workflow-run', status as WorkflowRunStatusInput)}>
            {tDynLoose(t, 'runStatus', enumKey(status))}
          </AtelierStatusPill>
        );
      },
    },
    {
      id: 'progress',
      header: t('columns.progress'),
      cell: ({ row }) => {
        const { done, total } = row.original.progress;
        return (
          <span className="text-sm tabular-nums">
            {done}/{total}
          </span>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'startedAt',
      header: t('columns.startedAt'),
      cell: ({ row }) => {
        const startedAt = row.original.startedAt;
        if (!startedAt) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          return <span className="text-sm">{fmtDate(startedAt)}</span>;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },
    {
      accessorKey: 'dueAt',
      header: t('columns.dueAt'),
      cell: ({ row }) => {
        const dueAt = row.original.dueAt;
        if (!dueAt) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          const date = new Date(dueAt);
          const isOverdue =
            date < new Date() &&
            row.original.status !== 'COMPLETED' &&
            row.original.status !== 'CANCELLED';

          if (isOverdue) {
            return (
              <span
                className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive"
                aria-label={`${fmtDate(date)} — ${t('runStatus.overdue')}`}>
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{fmtDate(date)}</span>
              </span>
            );
          }
          return <span className="text-sm">{fmtDate(date)}</span>;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },
  ];
}
