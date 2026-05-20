'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@contractor-ops/ui/components/shadcn/table';
import { useTranslations } from 'next-intl';

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

/**
 * Severity-pill + mono ruleId + message + mono xpath table, grouped by
 * layer. Severity pill is clickable to expand the row into a collapsible
 * showing the full message and xpath in mono font.
 *
 * Never uses `dangerouslySetInnerHTML` — all SVRL content is rendered as
 * plain text nodes (React auto-escapes → XSS threat T-61-08-01 mitigated).
 */
export function SvrlIssueList({ issues }: SvrlIssueListProps) {
  const t = useTranslations('EInvoice.InvoiceTab');

  if (issues.length === 0) return null;

  // Group by layer preserving insertion order.
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">{t('svrlSeverityHeader')}</TableHead>
                <TableHead className="w-40">{t('svrlRuleIdHeader')}</TableHead>
                <TableHead>{t('svrlMessageHeader')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {layerIssues.map((issue, idx) => {
                const severity = normaliseSeverity(issue.severity);
                return (
                  <TableRow key={`${issue.ruleId}-${idx}`} data-slot="svrl-issue-row">
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${SEVERITY_VARIANT[severity]}`}>
                        {severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-sm">{issue.ruleId}</code>
                    </TableCell>
                    <TableCell>
                      <Collapsible>
                        <CollapsibleTrigger
                          className="text-start text-sm hover:underline"
                          data-slot="svrl-issue-toggle">
                          {issue.message.length > 100
                            ? `${issue.message.slice(0, 100)}…`
                            : issue.message}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2 rounded-md bg-muted/30 p-3">
                            <p className="text-sm">{issue.message}</p>
                            <p>
                              <span className="text-xs text-muted-foreground">
                                {t('xpathLabel')}
                              </span>{' '}
                              <code className="font-mono text-xs break-all">{issue.xpath}</code>
                            </p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
