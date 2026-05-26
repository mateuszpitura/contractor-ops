/**
 * Teams table — Step 10 batch 6 / Step 11 codemod port from
 * apps/web/src/components/organization/teams/team-table.tsx:
 *   - `next-intl` → `../../../i18n/useTranslations.js`
 *   - `@/components/organization/shared/*` → relative imports
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { SourceBadge } from '../shared/source-badge.js';
import { StatusBadge } from '../shared/status-badge.js';
import type { TeamRow } from './team-form-sheet.js';

export interface TeamTableRow extends TeamRow {
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  source: 'MANUAL' | 'JIRA' | 'LINEAR';
  externalId: string | null;
  updatedAt: Date | string;
}

interface TeamTableProps {
  rows: TeamTableRow[];
  onRowClick?: (row: TeamTableRow) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function TeamTable({ rows, onRowClick, isLoading, isError, onRetry }: TeamTableProps) {
  const t = useTranslations('Organization');
  const tCommon = useTranslations('Common');
  const tProfile = useTranslations('ContractorProfile');

  if (isLoading) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm" aria-busy>
        Loading…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-12">
        <p className="text-sm text-muted-foreground">{tCommon('networkError')}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {tProfile('error.retry')}
          </Button>
        ) : null}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
        {t('teamsEmpty')}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-muted-foreground text-left">
            <th className="px-3 py-2 font-medium">{t('colName')}</th>
            <th className="px-3 py-2 font-medium">{t('colCode')}</th>
            <th className="px-3 py-2 font-medium">{t('colStatus')}</th>
            <th className="px-3 py-2 font-medium">{t('colSource')}</th>
            <th className="px-3 py-2 font-medium">{t('colUpdated')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className="hover:bg-muted/30 cursor-pointer border-t transition-colors"
              onClick={() => onRowClick?.(row)}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick?.(row);
                }
              }}>
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.code ?? '—'}</td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-3 py-2">
                <SourceBadge source={row.source} />
              </td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums">
                {format(new Date(row.updatedAt), 'yyyy-MM-dd')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
