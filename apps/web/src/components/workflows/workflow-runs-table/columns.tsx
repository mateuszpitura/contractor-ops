'use client';

import type { WorkflowRunStatusInput } from '@contractor-ops/ui';
import { AtelierStatusPill, statusToVariant } from '@contractor-ops/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { enumKey } from '@/lib/enum-key';

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
  OFFBOARDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  DOCUMENT_COLLECTION: 'bg-muted text-muted-foreground',
  COMPLIANCE_REVIEW: 'bg-muted text-muted-foreground',
  CUSTOM: 'bg-muted text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

type TranslateFunction = (key: string) => string;

/**
 * Returns all column definitions for the workflow runs data table.
 * Accepts a translation function for headers and labels.
 */
export function getColumns(t: TranslateFunction): ColumnDef<WorkflowRunRow>[] {
  return [
    // 1. Select checkbox
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

    // 2. Workflow name (template name)
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

    // 3. Contractor
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

    // 4. Template type
    {
      id: 'templateType',
      accessorFn: row => row.workflowTemplate.type,
      header: t('columns.templateType'),
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={templateTypeBadgeColors[row.original.workflowTemplate.type] ?? ''}>
          {t(`templateType.${enumKey(row.original.workflowTemplate.type)}`)}
        </Badge>
      ),
      enableSorting: false,
    },

    // 5. Status
    {
      accessorKey: 'status',
      header: t('columns.status'),
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <AtelierStatusPill
            variant={statusToVariant('workflow-run', status as WorkflowRunStatusInput)}>
            {t(`runStatus.${enumKey(status)}`)}
          </AtelierStatusPill>
        );
      },
    },

    // 6. Progress (X/Y)
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

    // 7. Started date
    {
      accessorKey: 'startedAt',
      header: t('columns.startedAt'),
      cell: ({ row }) => {
        const startedAt = row.original.startedAt;
        if (!startedAt) return <span className="text-muted-foreground">&mdash;</span>;
        try {
          return <span className="text-sm">{new Date(startedAt).toLocaleDateString('pl-PL')}</span>;
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },

    // 8. Due date (destructive color if overdue)
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

          return (
            <span className={`text-sm ${isOverdue ? 'text-destructive font-medium' : ''}`}>
              {date.toLocaleDateString('pl-PL')}
            </span>
          );
        } catch {
          return <span className="text-muted-foreground">&mdash;</span>;
        }
      },
    },
  ];
}
