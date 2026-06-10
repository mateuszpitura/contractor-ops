/**
 * SVRL issue list.
 */

import { WorkbenchDataTable } from '../../table-kit/workbench-data-table.js';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';

export type SvrlSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface SvrlIssue {
  layer: string;
  severity: string;
  ruleId: string;
  xpath: string;
  message: string;
}

interface SvrlIssueListProps {
  issues: SvrlIssue[];
}

const SEVERITY_VARIANT: Record<SvrlSeverity, string> = {
  fatal: 'border-destructive/40 text-destructive bg-destructive/10',
  error: 'border-destructive/40 text-destructive bg-destructive/10',
  warning: 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10',
  info: 'border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10',
};

function normaliseSeverity(raw: string): SvrlSeverity {
  const lower = raw.toLowerCase();
  if (lower === 'fatal' || lower === 'error' || lower === 'warning' || lower === 'info') {
    return lower;
  }
  return 'error';
}

interface LayerTableProps {
  issues: SvrlIssue[];
  xpathLabel: string;
  severityHeader: string;
  ruleIdHeader: string;
  messageHeader: string;
}

function LayerTable({
  issues,
  xpathLabel,
  severityHeader,
  ruleIdHeader,
  messageHeader,
}: LayerTableProps) {
  const noop = () => undefined;

  const columns = useMemo<ColumnDef<SvrlIssue, unknown>[]>(
    () => [
      {
        id: 'severity',
        header: () => severityHeader,
        size: 96,
        enableSorting: false,
        cell: ({ row }) => {
          const severity = normaliseSeverity(row.original.severity);
          return (
            <span data-slot="svrl-issue-row" className="inline-block">
              <Badge variant="outline" className={`capitalize ${SEVERITY_VARIANT[severity]}`}>
                {severity}
              </Badge>
            </span>
          );
        },
      },
      {
        id: 'ruleId',
        header: () => ruleIdHeader,
        size: 160,
        enableSorting: false,
        cell: ({ row }) => <code className="font-mono text-sm">{row.original.ruleId}</code>,
      },
      {
        id: 'message',
        header: () => messageHeader,
        enableSorting: false,
        cell: ({ row }) => (
          <Collapsible>
            <CollapsibleTrigger
              className="text-start text-sm hover:underline"
              data-slot="svrl-issue-toggle">
              {row.original.message.length > 100
                ? `${row.original.message.slice(0, 100)}…`
                : row.original.message}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 rounded-md bg-muted/30 p-3">
                <p className="text-sm">{row.original.message}</p>
                <p>
                  <span className="text-xs text-muted-foreground">{xpathLabel}</span>{' '}
                  <code className="font-mono text-xs break-all">{row.original.xpath}</code>
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ),
      },
    ],
    [xpathLabel, severityHeader, ruleIdHeader, messageHeader],
  );

  return (
    <WorkbenchDataTable
      sectionClassName=""
      columns={columns}
      data={issues}
      totalRows={issues.length}
      clientPagination
      pageIndex={0}
      pageSize={issues.length || 1}
      onPageChange={noop}
      onPageSizeChange={noop}
      getRowId={(row, idx) => `${row.ruleId}-${idx}`}
      hideChrome
      hideFooter
      hideDensityToggle
      constrainHeight={false}
      entityLabel="issues"
      emptyTitle=""
      noResultsTitle=""
    />
  );
}

export function SvrlIssueList({ issues }: SvrlIssueListProps) {
  const t = useTranslations('EInvoice.InvoiceTab');

  if (issues.length === 0) return null;

  const byLayer = new Map<string, SvrlIssue[]>();
  for (const issue of issues) {
    const bucket = byLayer.get(issue.layer) ?? [];
    bucket.push(issue);
    byLayer.set(issue.layer, bucket);
  }

  return (
    <div className="space-y-4">
      <h4 className="text-base font-semibold">{t('svrlIssueListHeading')}</h4>
      {Array.from(byLayer.entries()).map(([layer, layerIssues]) => (
        <div key={layer} className="space-y-2">
          <h5 className="text-sm font-medium text-muted-foreground">{layer}</h5>
          <LayerTable
            issues={layerIssues}
            xpathLabel={t('xpathLabel')}
            severityHeader={t('svrlSeverityHeader')}
            ruleIdHeader={t('svrlRuleIdHeader')}
            messageHeader={t('svrlMessageHeader')}
          />
        </div>
      ))}
    </div>
  );
}
